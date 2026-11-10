const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const fullCatalogue = JSON.parse(readFileSync(join(__dirname, "..", "public", "task-catalog.v1.json"), "utf8"));
const catalog = {
  version: 1,
  tasks: [
    {id: "race", title: "Tortoise race", description: "Find when B catches A.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["race"], expected: "race"}]},
    {id: "digitize", title: "Array sum", description: "Add all numbers in an array.", entryPoint: "echo", starterCode: "function echo(value) { return String(value); }", solution: "function echo(value) { return value; }", tests: [{args: ["array"], expected: "array"}]},
    {id: "no-space", title: "Count vowels", description: "Count vowels in a string.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["string"], expected: "string"}]},
    {id: "legacy", title: "Legacy task", description: "A catalog task with no topic metadata.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["legacy"], expected: "legacy"}]},
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
    await search.fill("ADD ALL");
    assert.equal(await catalogueRows(page).count(), 1, "title/description search is case-insensitive and combines with topic");
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
    await page.getByRole("button", {name: "Back to task"}).focus();
    assert.equal(await page.getByRole("button", {name: "Back to task"}).evaluate(node => node === document.activeElement), true, "Back is keyboard reachable");

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
      url: `${baseUrl}/task-catalog.v1.json`,
    }], "only the intentionally mocked catalogue failure writes a browser console error");
    assert.deepEqual(diagnostics.pageErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);
    assert.deepEqual(diagnostics.failedResponses, [{url: `${baseUrl}/task-catalog.v1.json`, method: "GET", status: 500}], "only the intentional first catalogue failure is observed");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("full fifty-task catalogue keeps the final task reachable", {timeout: 45_000}, async () => {
  assert.equal(Array.isArray(fullCatalogue.tasks), true, "the checked-out public catalogue exposes a task array");
  assert.equal(fullCatalogue.tasks.length, 50, "the TD007 fixture is the complete public fifty-task catalogue");
  const finalTask = fullCatalogue.tasks.at(-1);
  assert.ok(finalTask?.id && finalTask.title && finalTask.description, "the complete public catalogue exposes a final identifiable task");

  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage();
  const diagnostics = await prepare(page, route => route.fulfill({contentType: "application/json", body: JSON.stringify(fullCatalogue)}));

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});

    const rows = catalogueRows(page);
    assert.equal(await rows.count(), 50, "All tasks renders every member of the complete public catalogue before final-row checks");
    const finalRow = rows.nth(49);
    assert.match(await finalRow.innerText(), new RegExp(finalTask.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the final visible row belongs to the actual final public catalogue task");
    const finalOpen = finalRow.getByRole("button", {name: /^Open(?: |$)/});
    assert.equal(await finalOpen.count(), 1, "the actual final catalogue row exposes exactly one Open action");

    const beforeScroll = await finalOpen.evaluate(node => {
      const userScrollOwners = [];
      const hiddenOrClipAncestors = [];
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (["auto", "scroll"].includes(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight) userScrollOwners.push(ancestor.scrollTop);
        if (["hidden", "clip"].includes(style.overflowY)) hiddenOrClipAncestors.push(ancestor.scrollTop);
      }
      return {documentScrollY: window.scrollY, userScrollOwners, hiddenOrClipAncestors};
    });
    for (let step = 0; step < 20; step += 1) {
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, 720);
      const isVisible = await finalOpen.evaluate(node => {
        const bounds = node.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
      });
      if (isVisible) break;
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const reachability = await finalOpen.evaluate((node, beforeScroll) => {
      const target = node.getBoundingClientRect();
      const clippingAncestors = [];
      const userScrollOwners = [];
      const hiddenOrClipAncestors = [];
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const bounds = ancestor.getBoundingClientRect();
        const clipsX = ["hidden", "clip", "scroll", "auto"].includes(style.overflowX);
        const clipsY = ["hidden", "clip", "scroll", "auto"].includes(style.overflowY);
        if (clipsX || clipsY) clippingAncestors.push({bounds: [bounds.left, bounds.top, bounds.right, bounds.bottom], clipsX, clipsY});
        if (["auto", "scroll"].includes(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight) userScrollOwners.push(ancestor.scrollTop);
        if (["hidden", "clip"].includes(style.overflowY)) hiddenOrClipAncestors.push(ancestor.scrollTop);
      }
      const y = target.top + target.height / 2;
      const xPositions = [target.left + 1, target.left + target.width / 2, target.right - 1];
      return {
        target: [target.left, target.top, target.right, target.bottom],
        viewport: [window.innerWidth, window.innerHeight],
        clippingAncestors,
        userScrollOwners,
        hiddenOrClipAncestors,
        documentScroll: [window.scrollX, window.scrollY],
        hitTests: xPositions.map(x => ({x, containsTarget: Boolean(document.elementFromPoint(x, y) && node.contains(document.elementFromPoint(x, y)))})),
      };
    }, beforeScroll);
    const [left, top, right, bottom] = reachability.target;
    const [viewportWidth, viewportHeight] = reachability.viewport;
    assert.ok(left >= -0.5 && top >= -0.5 && right <= viewportWidth + 0.5 && bottom <= viewportHeight + 0.5, `the final Open action fits the 1440x900 viewport after scrolling: ${JSON.stringify(reachability)}`);
    for (const ancestor of reachability.clippingAncestors) {
      const [ancestorLeft, ancestorTop, ancestorRight, ancestorBottom] = ancestor.bounds;
      if (ancestor.clipsX) assert.ok(left >= ancestorLeft - 0.5 && right <= ancestorRight + 0.5, `the final Open action is horizontally reachable inside every clipping ancestor: ${JSON.stringify(reachability)}`);
      if (ancestor.clipsY) assert.ok(top >= ancestorTop - 0.5 && bottom <= ancestorBottom + 0.5, `the final Open action is vertically reachable inside every clipping ancestor: ${JSON.stringify(reachability)}`);
    }
    assert.ok(reachability.userScrollOwners.some((scrollTop, index) => scrollTop > beforeScroll.userScrollOwners[index]) || reachability.documentScroll[1] > beforeScroll.documentScrollY, `the final Open action is reached through a user-scrollable owner or the document: ${JSON.stringify(reachability)}`);
    assert.deepEqual(reachability.hiddenOrClipAncestors, beforeScroll.hiddenOrClipAncestors, `hidden or clip ancestors are not programmatically scrolled to make the final Open action reachable: ${JSON.stringify(reachability)}`);
    assert.ok(reachability.hitTests.every(point => point.containsTarget), `the final Open action is hit-testable at left, centre, and right: ${JSON.stringify(reachability)}`);

    await finalOpen.click();
    await page.getByText(finalTask.description, {exact: true}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "All tasks"}).click();
    const selectedFinalRow = page.locator('main ul > li[aria-current="true"]').filter({hasText: finalTask.title});
    assert.equal(await selectedFinalRow.count(), 1, "opening the final task makes that same real catalogue row current");
    assert.deepEqual(diagnostics.consoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);
    assert.deepEqual(diagnostics.failedResponses, []);
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
    assert.equal(desktop.fontSize, "26px");
    assert.equal(desktop.fontWeight, "600");
    assert.equal(desktop.background, "rgba(0, 0, 0, 0)");
    assert.equal(desktop.borderWidth, "0px");
    assert.equal(desktop.beforeWidth, "28px");
    assert.equal(desktop.beforeHeight, "24px");
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
        const selector = document.querySelector('[role="combobox"]');
        const actions = [document.querySelector('[aria-label="Select previous task"]'), selector, document.querySelector('[aria-label="Select next task"]')];
        const a = all.getBoundingClientRect();
        return actions.map(node => {
          const b = node.getBoundingClientRect();
          return Math.max(a.left, b.left) < Math.min(a.right, b.right) && Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom);
        });
      });
      assert.deepEqual(intersections, [false, false, false], `All tasks does not overlap an actionable header control at ${width}px`);
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
