const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {
  version: 1,
  tasks: [
    {id: "race", title: "Tortoise race", description: "Find when B catches A.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["race"], expected: "race"}]},
    {id: "digitize", title: "Array sum", description: "Add all numbers in an array.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["array"], expected: "array"}]},
  ],
};

test("All tasks reflects successful Test completion through Run and invalidates it after an edit", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}});
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpFailures = [];
  const catalogRequests = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => failedRequests.push({url: request.url(), error: request.failure()?.errorText ?? null}));
  page.on("response", response => {
    if (response.status() >= 400) httpFailures.push({url: response.url(), method: response.request().method(), status: response.status()});
  });
  await context.route("**/task-catalog.v1.json", async route => {
    assert.equal(route.request().method(), "GET", "the fixture only serves the catalogue GET boundary");
    catalogRequests.push(route.request().url());
    await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));

    await page.getByRole("button", {name: "Test Code"}).click();
    await page.getByText("Все тесты пройдены: 1/1", {exact: true}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "All tasks"}).click();
    const currentRow = page.locator('li[aria-current="true"]');
    await currentRow.getByText("Tortoise race", {exact: true}).waitFor({state: "visible"});
    await currentRow.getByText("Completed", {exact: true}).waitFor({state: "visible"});
    await page.getByRole("radio", {name: "Completed"}).check();
    await currentRow.getByText("Tortoise race", {exact: true}).waitFor({state: "visible"});
    assert.equal(await page.getByText("Array sum", {exact: true}).count(), 0, "Completed excludes a not-started row");
    await page.getByRole("radio", {name: "All statuses"}).check();
    await page.getByText("Array sum", {exact: true}).waitFor({state: "visible"});

    await page.getByRole("button", {name: "Back to task"}).click();
    await page.getByRole("button", {name: "Run Code"}).click();
    await page.getByText("Код выполнен", {exact: true}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "All tasks"}).click();
    await currentRow.getByText("Completed", {exact: true}).waitFor({state: "visible"});

    await page.getByRole("button", {name: "Back to task"}).click();
    const changed = await page.evaluate(() => {
      const model = (window.monaco?.editor.getModels() ?? []).find(candidate => candidate.getValue() === "function echo(value) { return value; }");
      if (!model) return false;
      model.setValue("function echo(value) { return value; }\n// changed");
      return true;
    });
    assert.equal(changed, true, "the visible Monaco draft is the connected edit boundary");
    await page.getByRole("button", {name: "All tasks"}).click();
    await currentRow.getByText("In progress", {exact: true}).waitFor({state: "visible"});
    assert.equal(await currentRow.getByText("Completed", {exact: true}).count(), 0, "editing a completed draft must revoke Completed");

    assert.deepEqual(catalogRequests, [new URL("/task-catalog.v1.json", baseUrl).href]);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(httpFailures, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
