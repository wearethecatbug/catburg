const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43814";

function writeBrowserDiagnostics(name, diagnostics) {
  const outputDirectory = process.env.CATTASKS_BROWSER_DIAGNOSTICS_DIR;
  if (!outputDirectory) return;
  fs.mkdirSync(outputDirectory, {recursive: true});
  fs.writeFileSync(path.join(outputDirectory, `${name}.json`), `${JSON.stringify(diagnostics, null, 2)}\n`);
}

const catalog = {
  version: 1,
  tasks: [
    {
      id: "foo/../../solution-other",
      title: "Unsafe ID task",
      description: "First task.",
      entryPoint: "echo",
      starterCode: "function echo(value) { return value; }",
      solution: "function echo(value) { return value; }",
      tests: [{args: ["first"], expected: "first"}],
    },
    {
      id: "other",
      title: "Other task",
      description: "Second task.",
      entryPoint: "echo",
      starterCode: "function echo(value) { return value + '!'; }",
      solution: "function echo(value) { return value + '!'; }",
      tests: [{args: ["second"], expected: "second!"}],
    },
  ],
};

async function visibleEditorText(page) {
  return page.locator(".monaco-editor .view-lines").innerText();
}

async function setActiveDraft(page, starterCode, value) {
  const changed = await page.evaluate(({starterCode, value}) => {
    const models = window.monaco?.editor.getModels() ?? [];
    const current = models.find(model => model.getValue() === starterCode);
    if (!current) return false;
    current.setValue(value);
    return true;
  }, {starterCode, value});
  assert.equal(changed, true, "the visible Monaco editor model must be available through its public API");
  await page.waitForFunction(expected => {
    const models = window.monaco?.editor.getModels() ?? [];
    return models.some(model => model.getValue() === expected);
  }, value);
}

async function selectTask(page, title) {
  const selector = page.getByRole("combobox");
  await selector.fill(title);
  const option = page.getByRole("option", {name: new RegExp(title)});
  await option.waitFor({state: "visible"});
  await option.click();
}

test("CatTasks keeps drafts per catalog identity and disables execution after clearing selection", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const catalogRequests = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => requestFailures.push({url: request.url(), method: request.method(), error: request.failure()?.errorText ?? null}));
  await context.route("**/task-catalog.v1.json", async route => {
    catalogRequests.push(route.request().url());
    await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    const selector = page.getByRole("combobox");
    await selector.waitFor({state: "visible"});
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
    await page.waitForFunction(() => document.querySelector("input[role='combobox']")?.value.includes("Unsafe ID task"));

    const firstDraft = "// draft: first\nfunction echo(value) { return value; }";
    const secondDraft = "// draft: second\nfunction echo(value) { return value + '!'; }";
    await setActiveDraft(page, catalog.tasks[0].starterCode, firstDraft);
    const draftInput = page.getByLabel("User JavaScript code");
    assert.equal(await draftInput.evaluate(element => element.readOnly), false, "the user draft editor remains editable");
    await selectTask(page, "Other task");
    await setActiveDraft(page, catalog.tasks[1].starterCode, secondDraft);
    await selectTask(page, "Unsafe ID task");
    await page.waitForFunction(expected => document.querySelector(".monaco-editor .view-lines")?.textContent?.replace(/\s/g, "") === expected.replace(/\s/g, ""), firstDraft, {timeout: 10_000});
    assert.equal((await visibleEditorText(page)).replace(/\s/g, ""), firstDraft.replace(/\s/g, ""), "A→B→A restores the draft owned by the URI-unsafe stable ID");

    await page.getByRole("button", {name: "Показать решение"}).click();
    const solutionInput = page.locator("[class*='taskSolutionContainer'] .monaco-editor textarea");
    await solutionInput.waitFor({state: "visible"});
    const solutionBeforeEdit = catalog.tasks[0].solution;
    assert.equal(await solutionInput.evaluate(element => element.readOnly), true, "the reference solution editor exposes native read-only semantics");
    await solutionInput.focus();
    await page.keyboard.type("// blocked");
    assert.equal(await page.evaluate(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), solutionBeforeEdit), true, "typing cannot change the reference solution");
    await page.getByRole("button", {name: "Показать описание"}).click();

    await page.getByRole("button", {name: "Select next task"}).click();
    await page.waitForFunction(() => document.querySelector("input[role='combobox']")?.value.includes("Other task"));
    await page.waitForFunction(expected => document.querySelector(".monaco-editor .view-lines")?.textContent?.replace(/\s/g, "") === expected.replace(/\s/g, ""), secondDraft);
    assert.equal((await visibleEditorText(page)).replace(/\s/g, ""), secondDraft.replace(/\s/g, ""), "arrow navigation uses the same selection state and preserves B draft");

    await page.getByRole("button", {name: "Очистить выбор задачи", exact: true}).click();
    await page.waitForFunction(() => document.querySelector("input[role='combobox']")?.value === "");
    assert.equal(await page.getByRole("button", {name: "Test Code"}).isDisabled(), true, "Test is unavailable with no selected task");
    assert.equal(await page.getByRole("button", {name: "Run Code"}).isDisabled(), true, "Run is unavailable with no selected task");
    assert.equal(await selector.evaluate(element => element === document.activeElement), true, "clear returns focus to the task selector");
    assert.deepEqual(catalogRequests, [new URL("/task-catalog.v1.json", baseUrl).href], "the dashboard issues one catalog request in this isolated scenario");
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(requestFailures, []);
  } finally {
    writeBrowserDiagnostics("draft-isolation", {catalogRequests, consoleErrors, pageErrors, requestFailures});
    await context.close();
    await browser.close();
  }
});

test("CatTasks shows a retryable catalog failure without claiming that it is still loading", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  let catalogAttempts = 0;
  await context.route("**/task-catalog.v1.json", async route => {
    catalogAttempts += 1;
    if (catalogAttempts === 1) {
      await route.fulfill({status: 503, contentType: "application/json", body: "{}"});
      return;
    }
    await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    const selector = page.getByRole("combobox");
    await selector.waitFor({state: "visible"});
    const catalogError = page.getByRole("alert").filter({hasText: "Не удалось загрузить каталог задач."});
    await catalogError.waitFor({state: "visible"});
    await selector.press("ArrowDown");
    const listbox = page.getByRole("listbox");
    await listbox.waitFor({state: "visible"});
    assert.equal(await listbox.textContent(), "Каталог недоступен.", "the empty open list describes the failed catalog request rather than an active load");

    await page.getByRole("button", {name: "Повторить"}).click();
    await catalogError.waitFor({state: "hidden"});
    await selector.press("ArrowDown");
    await page.getByRole("option").first().waitFor({state: "visible"});
    assert.equal(await catalogError.count(), 0, "a successful retry clears the catalog failure alert");
    assert.equal(catalogAttempts, 2, "retry makes one additional catalog request");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks retains an explicit clear made while the catalog request is pending", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const catalogRequests = [];
  let releaseCatalog;
  const catalogRelease = new Promise(resolve => { releaseCatalog = resolve; });
  const catalogUrl = new URL("/task-catalog.v1.json", baseUrl).href;
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => requestFailures.push({url: request.url(), method: request.method(), error: request.failure()?.errorText ?? null}));
  await context.route("**/task-catalog.v1.json", async route => {
    catalogRequests.push(route.request().url());
    await catalogRelease;
    await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });

  try {
    const catalogRequest = page.waitForRequest(request => request.url() === catalogUrl, {timeout: 5_000});
    const response = await page.goto(baseUrl, {waitUntil: "commit", timeout: 5_000});
    assert.equal(response.status(), 200);
    const selector = page.getByRole("combobox");
    const clear = page.getByLabel("Очистить выбор задачи", {exact: true});
    await selector.waitFor({state: "visible", timeout: 5_000});
    await clear.waitFor({state: "visible", timeout: 5_000});
    await catalogRequest;

    await clear.click({timeout: 5_000});
    releaseCatalog();

    const nextTask = page.getByRole("button", {name: "Select next task"});
    await nextTask.waitFor({state: "visible", timeout: 5_000});
    await page.waitForFunction(() => !document.querySelector("button[aria-label='Select next task']")?.hasAttribute("disabled"), undefined, {timeout: 5_000});
    await selector.press("ArrowDown", {timeout: 5_000});
    await page.getByRole("option").first().waitFor({state: "visible", timeout: 5_000});
    assert.equal(await page.getByRole("option").count(), 2, "the fulfilled catalog exposes both known tasks");
    assert.equal(await page.getByRole("option").first().getAttribute("aria-selected"), "false", "an unselected task option exposes its selection state to assistive technology");
    await page.keyboard.press("Escape");

    assert.equal(await selector.inputValue(), "", "the fulfilled catalog does not overwrite a pending explicit clear");
    assert.equal(await page.getByRole("button", {name: "Test Code"}).isDisabled(), true, "Test remains unavailable until the user selects a task");
    assert.equal(await page.getByRole("button", {name: "Run Code"}).isDisabled(), true, "Run remains unavailable until the user selects a task");
    assert.equal(await selector.evaluate(element => element === document.activeElement), true, "catalog rendering retains selector focus after clear");
    assert.deepEqual(catalogRequests, [catalogUrl], "the delayed-catalog scenario makes one request");

    await selectTask(page, "Unsafe ID task");
    await page.waitForFunction(() => document.querySelector("input[role='combobox']")?.value.includes("Unsafe ID task"), undefined, {timeout: 5_000});
    assert.equal(await page.getByRole("button", {name: "Test Code"}).isDisabled(), false, "a manual valid selection restores Test");
    assert.equal(await page.getByRole("button", {name: "Run Code"}).isDisabled(), false, "a manual valid selection restores Run");
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(requestFailures, []);
  } finally {
    releaseCatalog();
    writeBrowserDiagnostics("pending-clear", {catalogRequests, consoleErrors, pageErrors, requestFailures});
    await context.close();
    await browser.close();
  }
});
