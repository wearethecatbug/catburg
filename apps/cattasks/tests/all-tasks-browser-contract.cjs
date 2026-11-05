const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {
  version: 1,
  tasks: [
    {id: "race", title: "Tortoise race", description: "Find when B catches A.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["race"], expected: "race"}]},
    {id: "digitize", title: "Array sum", description: "Add all numbers in an array.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["array"], expected: "array"}]},
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
    await page.getByLabel(/Показать информацию|Показана информация/).click();
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
    assert.match(await page.getByLabel(/Показана информация/).getAttribute("aria-label"), /Показана информация/, "Back preserves the active tab");
    await page.getByLabel(/Показать решение|Показано решение/).click();
    await page.waitForFunction(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), "function echo(value) { return value + '!'; }");

    await page.getByRole("button", {name: "All tasks"}).click();
    const arrayRow = catalogueRows(page).filter({hasText: "Array sum"});
    await arrayRow.getByRole("button", {name: /^Open(?: |$)/}).click();
    await page.getByText("Add all numbers in an array.", {exact: true}).waitFor({state: "visible"});
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await page.getByRole("button", {name: "All tasks"}).click();
    await catalogueRows(page).filter({hasText: "Tortoise race"}).getByRole("button", {name: /^Open(?: |$)/}).click();
    await page.getByText("Find when B catches A.", {exact: true}).waitFor({state: "visible"});
    await page.waitForFunction(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), "function echo(value) { return value + '!'; }");

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
