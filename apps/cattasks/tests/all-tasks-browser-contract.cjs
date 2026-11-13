const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {
  version: 1,
  tasks: [
    {id: "race", title: "Tortoise race", description: "Find when B catches A.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["race"], expected: "race"}]},
    {id: "digitize", title: "Array sum", description: "Add all numbers in an array.", entryPoint: "echo", starterCode: "function echo(value) { return String(value); }", solution: "function echo(value) { return value; }", tests: [{args: ["array"], expected: "array"}]},
    {id: "no-space", title: "Count vowels", description: "Count vowels in a string.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["string"], expected: "string"}]},
    {id: "legacy", title: "Legacy task", description: "A catalog task with no topic metadata.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["legacy"], expected: "legacy"}]},
  ],
};

function fixtureTask(id, title, description, difficulty) {
  return {
    id,
    title,
    description,
    entryPoint: "echo",
    starterCode: "function echo(value) { return value; }",
    solution: "function echo(value) { return value; }",
    tests: [{args: [id], expected: id}],
    ...(difficulty ? {difficulty} : {}),
  };
}

// This fixture deliberately mixes the public catalogue difficulty values with one
// legacy no-difficulty task. The browser contract must prove filtering behavior,
// not implementation-specific grouping helpers.
const mixedDifficultyCatalog = {
  version: 1,
  tasks: [
    fixtureTask("race", "Easy number race", "Easy race search needle.", "Easy"),
    fixtureTask("digitize", "Medium array sum", "Medium array search needle.", "Medium"),
    fixtureTask("no-space", "Hard vowel count", "Hard string search needle.", "Hard"),
    fixtureTask("easy-second", "Easy second", "Another easy task.", "Easy"),
    fixtureTask("medium-second", "Medium second", "Another medium task.", "Medium"),
    fixtureTask("hard-second", "Hard second", "Another hard task.", "Hard"),
    fixtureTask("easy-third", "Easy third", "A third easy task.", "Easy"),
    fixtureTask("medium-third", "Medium third", "A third medium task.", "Medium"),
    fixtureTask("hard-third", "Hard third", "A third hard task.", "Hard"),
    fixtureTask("legacy-unrated", "Legacy unrated", "No difficulty metadata.", undefined),
  ],
};

async function prepare(page, routeCatalog) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const failedResponses = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push({text: message.text(), url: message.location().url});
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => failedRequests.push({url: request.url(), error: request.failure()?.errorText ?? null}));
  page.on("response", response => {
    if (response.status() >= 400) failedResponses.push({url: response.url(), method: response.request().method(), status: response.status()});
  });
  await page.route("**/task-catalog.v1.json", routeCatalog);
  return {consoleErrors, pageErrors, failedRequests, failedResponses};
}

async function setDraft(page, previous, next) {
  await page.getByLabel(/Показать решение|Показано решение/).click();
  await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
  const value = await page.evaluate(({previous, next}) => {
    const model = (window.monaco?.editor.getModels() ?? []).find(candidate => candidate.getValue() === previous);
    if (!model) return null;
    model.setValue(next);
    return model.getValue();
  }, {previous, next});
  assert.equal(value, next, "the real Monaco draft must change through its model without executing fixture code");
}

async function assertActiveEditorDraft(page, expected, message) {
  const editor = page.getByLabel("User JavaScript code");
  await editor.waitFor({state: "visible"});
  const viewLines = editor.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' monaco-editor ')]").locator(".view-lines");
  await viewLines.waitFor({state: "visible"});
  await page.waitForFunction(expected => {
    const textarea = document.querySelector('textarea[aria-label="User JavaScript code"]');
    const activeEditor = (window.monaco?.editor.getEditors() ?? []).find(candidate => candidate.getDomNode()?.contains(textarea));
    return activeEditor?.getModel()?.getValue() === expected;
  }, expected);
  const actual = await page.evaluate(() => {
    const textarea = document.querySelector('textarea[aria-label="User JavaScript code"]');
    const activeEditor = (window.monaco?.editor.getEditors() ?? []).find(candidate => candidate.getDomNode()?.contains(textarea));
    return activeEditor?.getModel()?.getValue() ?? null;
  });
  assert.equal(actual, expected, message);
}

function catalogueRows(page) {
  return page.locator("main ul > li");
}

async function assertHorizontallyReachable(page, locator, label) {
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const count = await locator.count();
  assert.ok(count > 0, `${label} must expose at least one actionable element`);
  for (let index = 0; index < count; index += 1) {
    const target = locator.nth(index);
    await target.evaluate(node => window.scrollTo({left: window.scrollX, top: Math.max(0, node.getBoundingClientRect().top + window.scrollY - 16)}));
    const box = await target.boundingBox();
    assert.ok(box, `${label} ${index + 1} must have a rendered box`);
    assert.ok(box.x >= 0 && box.x + box.width <= viewportWidth, `${label} ${index + 1} must fit inside the ${viewportWidth}px viewport`);
    const reachability = await target.evaluate(node => {
      const targetBox = node.getBoundingClientRect();
      const clippingAncestors = [];
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (["hidden", "clip", "scroll", "auto"].includes(style.overflowX) || ["hidden", "clip", "scroll", "auto"].includes(style.overflowY)) {
          const box = ancestor.getBoundingClientRect();
          clippingAncestors.push({
            bounds: [box.left, box.top, box.right, box.bottom],
            containsTarget: targetBox.left >= box.left && targetBox.top >= box.top && targetBox.right <= box.right && targetBox.bottom <= box.bottom,
          });
        }
      }
      const y = targetBox.top + targetBox.height / 2;
      const hitTested = [targetBox.left + 1, targetBox.left + targetBox.width / 2, targetBox.right - 1]
        .map(x => ({x, hit: document.elementFromPoint(x, y)}));
      return {
        targetBounds: [targetBox.left, targetBox.top, targetBox.right, targetBox.bottom],
        clippingAncestors,
        hitTested: hitTested.map(({x, hit}) => ({x, reachable: Boolean(hit && node.contains(hit))})),
      };
    });
    assert.ok(reachability.clippingAncestors.every(ancestor => ancestor.containsTarget), `${label} ${index + 1} must not be clipped by an ancestor: ${JSON.stringify(reachability)}`);
    assert.ok(reachability.hitTested.every(point => point.reachable), `${label} ${index + 1} must be fully hit-testable: ${JSON.stringify(reachability)}`);
  }
}

async function catalogueGridTextOrigins(page) {
  return page.locator("section[aria-labelledby='taskListTitle']").evaluate(section => {
    const heading = section.querySelector("div[class*='columnHeadings']");
    const rows = [...section.querySelectorAll("li")];
    if (!heading || rows.length === 0) return null;
    const textLeft = node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    };
    const headerCells = [...heading.children];
    return {
      headingDisplay: getComputedStyle(heading).display,
      headingTemplate: getComputedStyle(heading).gridTemplateColumns,
      headers: [textLeft(headerCells[1]), textLeft(headerCells[2]), textLeft(headerCells[3])],
      rows: rows.map(row => {
        const rowCells = [...row.children];
        return {
          isCurrent: row.getAttribute("aria-current") === "true",
          template: getComputedStyle(row).gridTemplateColumns,
          values: [textLeft(rowCells[1]), textLeft(rowCells[2]), textLeft(rowCells[3])],
        };
      }),
    };
  });
}

test("All tasks uses real catalogue rows, combined filters, and preserves the Provider workspace", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1536, height: 1024}});
  const page = await context.newPage();
  const diagnostics = await prepare(page, route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
    await setDraft(page, catalog.tasks[0].starterCode, "function echo(value) { return value + '!'; }");
    await page.getByLabel(/Hint: Показать подсказки|Hint: Показаны подсказки/).click();
    await page.getByRole("button", {name: "All tasks"}).click();

    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
    const search = page.getByRole("searchbox", {name: "Search tasks"});
    await search.waitFor({state: "visible"});
    assert.equal(await search.evaluate(node => node === document.activeElement), true, "the catalogue moves initial keyboard focus to search");
    const topicGroup = page.getByRole("group", {name: "Topics"});
    const statusGroup = page.getByRole("group", {name: "Status"});
    assert.equal(await topicGroup.getByRole("radio").count(), 5, "Topics exposes exactly the supported taxonomy choices");
    assert.equal(await statusGroup.getByRole("radio").count(), 3, "Status exposes exactly the approved choices");
    for (const name of ["All topics", "Arrays", "Strings", "Numbers", "Logic", "All statuses", "Not started", "Completed"]) {
      await page.getByRole("radio", {name, exact: true}).waitFor({state: "visible"});
    }
    assert.equal(await page.getByRole("radio", {name: "All topics"}).isChecked(), true);
    assert.equal(await page.getByRole("radio", {name: "All statuses"}).isChecked(), true);
    assert.equal(await catalogueRows(page).count(), 4, "only the four real fixture tasks are rendered, with no mockup rows");
    assert.deepEqual(await page.locator("[data-task-ordinal]").allTextContents(), ["01", "02", "03", "04"], "catalogue displays padded source ordinals instead of visible-row indexes");
    assert.equal(await page.getByText("Tortoise race", {exact: true}).count(), 1);
    assert.equal(await page.getByText("Find when B catches A.", {exact: true}).count(), 1);
    const currentRow = page.locator('li[aria-current="true"]');
    assert.equal(await currentRow.count(), 1, "exactly one selected task is marked current");
    assert.equal(await currentRow.getByText("Numbers", {exact: true}).count(), 1);
    assert.equal(await page.getByText("In progress", {exact: true}).count(), 1, "the current task status is derived from its edited real workspace");
    await currentRow.getByRole("button", {name: "Open", exact: true}).click();
    await page.getByRole("button", {name: "All tasks"}).waitFor({state: "visible"});
    assert.equal(await page.getByLabel("Hint: Показаны подсказки").getAttribute("aria-label"), "Hint: Показаны подсказки", "Back preserves the active tab");
    await page.getByLabel(/Показать решение|Показано решение/).click();
    await assertActiveEditorDraft(page, "function echo(value) { return value + '!'; }", "Open restores the Tortoise draft in the rendered active editor");

    await page.getByRole("button", {name: "All tasks"}).click();
    const arrayRow = catalogueRows(page).filter({hasText: "Array sum"});
    await arrayRow.getByRole("button", {name: /^Open(?: |$)/}).click();
    await page.getByText("Add all numbers in an array.", {exact: true}).waitFor({state: "visible"});
    await assertActiveEditorDraft(page, catalog.tasks[1].starterCode, "Open renders Array sum's own draft instead of a cached Tortoise model");
    await page.getByRole("button", {name: "All tasks"}).click();
    await catalogueRows(page).filter({hasText: "Tortoise race"}).getByRole("button", {name: /^Open(?: |$)/}).click();
    await page.getByText("Find when B catches A.", {exact: true}).waitFor({state: "visible"});
    await assertActiveEditorDraft(page, "function echo(value) { return value + '!'; }", "returning from Array sum restores Tortoise's draft in the rendered active editor");

    await page.getByRole("button", {name: "All tasks"}).press("Enter");
    await page.getByRole("radio", {name: "Arrays"}).check();
    assert.equal(await catalogueRows(page).count(), 1);
    assert.equal(await page.getByText("Array sum", {exact: true}).count(), 1);
    assert.deepEqual(await page.locator("[data-task-ordinal]").allTextContents(), ["02"], "topic filtering retains Array sum's source ordinal");
    await search.fill("ADD ALL");
    assert.equal(await catalogueRows(page).count(), 1, "title/description search is case-insensitive and combines with topic");
    assert.deepEqual(await page.locator("[data-task-ordinal]").allTextContents(), ["02"], "search filtering never renumbers the surviving row");
    await page.getByRole("radio", {name: "Completed"}).check();
    await page.getByText("No tasks match these filters.", {exact: true}).waitFor({state: "visible"});
    await page.getByRole("radio", {name: "All statuses"}).check();
    await page.getByRole("radio", {name: "Logic"}).check();
    await page.getByText("No tasks match these filters.", {exact: true}).waitFor({state: "visible"});
    await page.getByRole("radio", {name: "All topics"}).check();
    await search.fill("TORTOISE");
    await page.getByText("Tortoise race", {exact: true}).waitFor({state: "visible"});
    assert.equal(await page.getByText("In progress", {exact: true}).count(), 1, "All statuses includes In progress");
    await page.getByRole("radio", {name: "Not started"}).check();
    await page.getByText("No tasks match these filters.", {exact: true}).waitFor({state: "visible"});

    await page.getByRole("radio", {name: "All statuses"}).check();
    await search.fill("");
    for (const width of [1440, 1121]) {
      await page.setViewportSize({width, height: 900});
      const grid = await catalogueGridTextOrigins(page);
      assert.ok(grid, `${width}px renders both column headings and a catalogue row`);
      assert.ok(grid.rows.some(row => row.isCurrent) && grid.rows.some(row => !row.isCurrent), `${width}px renders both current and icon-action catalogue rows`);
      for (const row of grid.rows) {
        assert.equal(grid.headingTemplate, row.template, `${width}px headers and ${row.isCurrent ? "current" : "other"} rows share the same five desktop tracks`);
        for (let index = 0; index < grid.headers.length; index += 1) {
          assert.ok(Math.abs(grid.headers[index] - row.values[index]) <= 1, `${width}px Task/Topic/Status text origins align in ${row.isCurrent ? "current" : "other"} rows despite different action widths`);
        }
      }
    }

    await page.setViewportSize({width: 1120, height: 900});
    const compactGrid = await catalogueGridTextOrigins(page);
    assert.ok(compactGrid, "1120px still renders a catalogue row");
    assert.equal(compactGrid.headingDisplay, "none", "1120px hides desktop column headings before the stacked-row layout");
    assert.deepEqual(await page.locator("[data-task-ordinal]").allTextContents(), ["01", "02", "03", "04"], "difficulty grouping and current state retain every source ordinal");
    await page.setViewportSize({width: 1060, height: 900});
    await assertHorizontallyReachable(page, catalogueRows(page).getByRole("button", {name: /^Open(?: |$)/}), "Open action at 1060px");

    await page.setViewportSize({width: 768, height: 900});
    await assertHorizontallyReachable(page, search, "Search");
    await assertHorizontallyReachable(page, page.getByRole("radio"), "filter radio");
    await assertHorizontallyReachable(page, catalogueRows(page).getByRole("button", {name: /^Open(?: |$)/}), "Open action");
    await assertHorizontallyReachable(page, page.getByRole("button", {name: "Back to task"}), "Back action");

    await page.setViewportSize({width: 390, height: 844});
    await assertHorizontallyReachable(page, search, "Search");
    await assertHorizontallyReachable(page, page.getByRole("radio"), "filter radio");
    await assertHorizontallyReachable(page, catalogueRows(page).getByRole("button", {name: /^Open(?: |$)/}), "Open action");
    await assertHorizontallyReachable(page, page.getByRole("button", {name: "Back to task"}), "Back action");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, "390px catalogue has no actionable horizontal overflow");
    const newTask = page.getByRole("button", {name: "New task"});
    await assertHorizontallyReachable(page, newTask, "New task at 390px");
    assert.equal(await newTask.evaluate(node => {
      const parent = node.parentElement;
      const parentStyle = getComputedStyle(parent);
      const contentWidth = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);
      return Math.abs(node.getBoundingClientRect().width - contentWidth) <= 1;
    }), true, "390px New task spans its custom-control column");
    await page.getByRole("button", {name: "Back to task"}).focus();
    assert.equal(await page.getByRole("button", {name: "Back to task"}).evaluate(node => node === document.activeElement), true, "Back is keyboard reachable");

    await page.setViewportSize({width: 320, height: 844});
    await assertHorizontallyReachable(page, search, "Search at 320px");
    await assertHorizontallyReachable(page, newTask, "New task at 320px");
    await assertHorizontallyReachable(page, page.getByLabel("Import tasks JSON").locator("xpath=.."), "Import tasks JSON at 320px");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "320px catalogue has no actionable horizontal overflow");

    assert.deepEqual(diagnostics.consoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);
    assert.deepEqual(diagnostics.failedResponses, []);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("All tasks difficulty is an accessible multi-select applied before eight-row pagination", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();
  const diagnostics = await prepare(page, route => route.fulfill({contentType: "application/json", body: JSON.stringify(mixedDifficultyCatalog)}));

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});

    const difficulty = page.getByRole("group", {name: "Difficulty"});
    const all = difficulty.getByRole("button", {name: "All", exact: true});
    const easy = difficulty.getByRole("button", {name: "Easy", exact: true});
    const medium = difficulty.getByRole("button", {name: "Medium", exact: true});
    const hard = difficulty.getByRole("button", {name: "Hard", exact: true});
    for (const control of [all, easy, medium, hard]) await control.waitFor({state: "visible"});
    assert.equal(await all.getAttribute("aria-pressed"), "true", "All is derived from all three selected difficulties");
    assert.deepEqual(await Promise.all([easy, medium, hard].map(control => control.getAttribute("aria-pressed"))), ["true", "true", "true"]);
    assert.equal(await easy.evaluate(node => getComputedStyle(node).minHeight), "48px", "each difficulty column is a 48px minimum native button target");
    assert.match(await easy.locator("span").first().evaluate(node => getComputedStyle(node).backgroundImage), /rgb\(180, 198, 156\).*rgb\(155, 180, 124\)/, "Easy has its approved light green bar");
    assert.match(await medium.locator("span").first().evaluate(node => getComputedStyle(node).backgroundImage), /rgb\(141, 170, 104\).*rgb\(111, 147, 74\)/, "Medium has its approved medium green bar");
    assert.match(await hard.locator("span").first().evaluate(node => getComputedStyle(node).backgroundImage), /rgb\(95, 132, 63\).*rgb\(62, 101, 40\)/, "Hard has its approved deep green bar");
    assert.equal(await page.getByText("1–8 of 10 tasks", {exact: true}).count(), 1, "all difficulties are filtered before the eight-row page slice");
    assert.deepEqual(await page.locator("[data-task-ordinal]").allTextContents(), ["01", "04", "07", "02", "05", "08", "03", "06"], "page one preserves ordinals after Easy/Medium/Hard ordering");

    await all.click();
    assert.equal(await all.getAttribute("aria-pressed"), "true", "pressing an already active All preserves all three selections");
    await page.getByRole("button", {name: "Next page"}).click();
    await page.getByText("9–10 of 10 tasks", {exact: true}).waitFor({state: "visible"});
    assert.deepEqual(await page.locator("[data-task-ordinal]").allTextContents(), ["09", "10"]);

    await medium.click();
    await page.getByText("1–6 of 6 tasks", {exact: true}).waitFor({state: "visible"});
    assert.equal(await medium.getAttribute("aria-pressed"), "false");
    assert.equal(await all.getAttribute("aria-pressed"), "false", "All becomes inactive when one selected level is removed");
    assert.deepEqual(await page.locator("[data-task-ordinal]").allTextContents(), ["01", "04", "07", "03", "06", "09"], "difficulty filtering is OR and legacy Unrated is not shown for a partial selection");
    await medium.focus();
    await medium.press("Space");
    assert.equal(await medium.getAttribute("aria-pressed"), "true", "Space toggles a native difficulty button");
    assert.equal(await all.getAttribute("aria-pressed"), "true", "manual restoration of all levels also activates All");
    await medium.press("Enter");
    assert.equal(await medium.getAttribute("aria-pressed"), "false", "Enter toggles the focused difficulty button");
    await medium.press("Enter");
    await page.getByText("1–8 of 10 tasks", {exact: true}).waitFor({state: "visible"});

    const search = page.getByRole("searchbox", {name: "Search tasks"});
    await search.fill("medium array");
    await page.getByRole("radio", {name: "Arrays"}).check();
    await page.getByRole("radio", {name: "Not started"}).check();
    await page.getByText("Medium array sum", {exact: true}).waitFor({state: "visible"});
    await easy.click();
    await hard.click();
    assert.equal(await medium.getAttribute("aria-pressed"), "true", "a single difficulty can remain selected while other filters stay applied");
    await medium.click();
    await page.getByRole("status").getByRole("heading", {name: "No difficulty selected"}).waitFor({state: "visible"});
    await page.getByRole("status").getByText("Choose a difficulty to see tasks.", {exact: true}).waitFor({state: "visible"});
    assert.equal(await catalogueRows(page).count(), 0, "an empty difficulty selection is not silently replaced with All");
    await page.getByRole("button", {name: "Select all", exact: true}).click();
    await page.getByText("Medium array sum", {exact: true}).waitFor({state: "visible"});
    assert.equal(await search.inputValue(), "medium array", "Select all preserves search");
    assert.equal(await page.getByRole("radio", {name: "Arrays"}).isChecked(), true, "Select all preserves Topics");
    assert.equal(await page.getByRole("radio", {name: "Not started"}).isChecked(), true, "Select all preserves Status");
    assert.equal(await page.getByText("1–1 of 1 tasks", {exact: true}).count(), 1, "Difficulty combines with search, topic and status through AND");

    await page.setViewportSize({width: 390, height: 844});
    await assertHorizontallyReachable(page, difficulty.getByRole("button"), "Difficulty controls at 390px");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "390px difficulty controls create no horizontal overflow");
    assert.deepEqual(diagnostics.consoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);
    assert.deepEqual(diagnostics.failedResponses, []);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("All tasks separates loading and recoverable catalogue errors", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  let attempt = 0;
  let releaseInitialLoad;
  let observeInitialRequest;
  const initialLoad = new Promise(resolve => { releaseInitialLoad = resolve; });
  const initialRequestStarted = new Promise(resolve => { observeInitialRequest = resolve; });
  const diagnostics = await prepare(page, async route => {
    attempt += 1;
    if (attempt === 1) {
      observeInitialRequest();
      await initialLoad;
      return route.fulfill({status: 500, contentType: "application/json", body: "{}"});
    }
    return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });
  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    await initialRequestStarted;
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("status").getByText("Loading tasks…", {exact: true}).waitFor({state: "visible"});
    releaseInitialLoad();
    await page.getByRole("alert").getByText("Tasks could not be loaded.", {exact: true}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "Try again"}).click();
    await page.getByText("Tortoise race", {exact: true}).waitFor({state: "visible"});
    assert.equal(attempt, 2, "retry makes one fresh catalogue request after recoverable failure");
    assert.deepEqual(diagnostics.consoleErrors, [{
      text: "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
      url: `${baseUrl.replace(/\/$/, '')}/task-catalog.v1.json`,
    }], "only the intentionally mocked catalogue failure writes a browser console error");
    assert.deepEqual(diagnostics.pageErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);
    assert.deepEqual(diagnostics.failedResponses, [{url: `${baseUrl.replace(/\/$/, '')}/task-catalog.v1.json`, method: "GET", status: 500}], "only the intentional first catalogue failure is observed");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("All tasks remains a left header link through compact resizing and returns keyboard focus", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1536, height: 1024}});
  const page = await context.newPage();
  const diagnostics = await prepare(page, route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    const allTasks = page.getByRole("button", {name: "All tasks"});
    const previous = page.getByRole("button", {name: "Select previous task"});
    const next = page.getByRole("button", {name: "Select next task"});
    await allTasks.waitFor({state: "visible"});
    await previous.waitFor({state: "visible"});
    await next.waitFor({state: "visible"});

    const desktop = await page.evaluate(() => {
      const link = document.querySelector('button') && [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === "All tasks");
      const previous = document.querySelector('[aria-label="Select previous task"]');
      const next = document.querySelector('[aria-label="Select next task"]');
      const style = getComputedStyle(link);
      const before = getComputedStyle(link, "::before");
      const bounds = link.getBoundingClientRect();
      return {bounds: [bounds.left, bounds.top, bounds.right, bounds.bottom], previous: previous.getBoundingClientRect().left, next: next.getBoundingClientRect().right, color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, background: style.backgroundColor, borderWidth: style.borderWidth, beforeWidth: before.width, beforeHeight: before.height, beforeColor: before.color};
    });
    assert.ok(desktop.bounds[2] < desktop.previous, "All tasks is visually separate to the left of the centered navigation");
    assert.equal(desktop.color, "rgb(35, 75, 54)");
    assert.equal(desktop.fontSize, "18px");
    assert.equal(desktop.fontWeight, "600");
    assert.equal(desktop.background, "rgba(0, 0, 0, 0)");
    assert.equal(desktop.borderWidth, "0px");
    assert.equal(desktop.beforeWidth, "18px");
    assert.equal(desktop.beforeHeight, "18px");
    assert.equal(desktop.beforeColor, desktop.color, "the decorative arrow inherits currentColor");

    await allTasks.hover();
    await page.waitForTimeout(180);
    assert.equal(await allTasks.evaluate(node => getComputedStyle(node).color), "rgb(57, 114, 79)");
    assert.match(await allTasks.evaluate(node => getComputedStyle(node).transition), /color 0.14s/);
    await allTasks.focus();
    assert.notEqual(await allTasks.evaluate(node => getComputedStyle(node).outlineStyle), "none", "keyboard focus stays visible");

    for (const width of [1536, 1250, 1100, 1000, 981, 980, 780, 390, 780, 1000, 1250, 1536]) {
      await page.setViewportSize({width, height: 900});
      await assertHorizontallyReachable(page, allTasks, `All tasks at ${width}px`);
      await assertHorizontallyReachable(page, previous, `previous navigation at ${width}px`);
      await assertHorizontallyReachable(page, next, `next navigation at ${width}px`);
      const intersections = await page.evaluate(() => {
        const all = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === "All tasks");
        const actions = [document.querySelector('[aria-label="Select previous task"]'), document.querySelector('[aria-label="Select next task"]')].filter(node => node && getComputedStyle(node).display !== "none");
        const a = all.getBoundingClientRect();
        return actions.map(node => {
          const b = node.getBoundingClientRect();
          return Math.max(a.left, b.left) < Math.min(a.right, b.right) && Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom);
        });
      });
      assert.deepEqual(intersections, Array(intersections.length).fill(false), `All tasks does not overlap an actionable header control at ${width}px`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0, `All tasks does not create horizontal overflow at ${width}px`);
    }

    await allTasks.click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "Back to task"}).click();
    await allTasks.waitFor({state: "visible"});
    assert.equal(await allTasks.evaluate(node => node === document.activeElement), true, "Back restores focus to the relocated All tasks control");
    assert.deepEqual(diagnostics.consoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);
    assert.deepEqual(diagnostics.failedResponses, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
