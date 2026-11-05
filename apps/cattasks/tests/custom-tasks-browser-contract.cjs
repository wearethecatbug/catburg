const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:3002";
const storageKey = "cattasks.custom-tasks.v1";
const catalog = {
  version: 1,
  tasks: [
    {id: "race", title: "Race fixture", description: "First inert built-in fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["race"], expected: "race"}]},
    {id: "digitize", title: "Digitize fixture", description: "Second inert built-in fixture.", entryPoint: "echo", starterCode: "function echo(value) { return `${value}!`; }", solution: "function echo(value) { return `${value}!`; }", tests: [{args: ["digitize"], expected: "digitize!"}]},
  ],
};

function customTask(id, overrides = {}) {
  return {
    id,
    title: `Custom ${id}`,
    description: "An inert custom browser fixture.",
    entryPoint: "echo",
    starterCode: "function echo(value) { return String(value); }",
    solution: "function echo(value) { return String(value); }",
    tests: [{args: [id], expected: id}],
    ...overrides,
  };
}

async function diagnostics(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const failedResponses = [];
  const catalogMethods = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => failedRequests.push({url: request.url(), error: request.failure()?.errorText ?? null}));
  page.on("response", response => { if (response.status() >= 400) failedResponses.push({url: response.url(), status: response.status()}); });
  await page.route("**/task-catalog.v1.json", route => {
    catalogMethods.push(route.request().method());
    return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });
  return {consoleErrors, pageErrors, failedRequests, failedResponses, catalogMethods};
}

async function openCatalogue(page) {
  await waitForTaskEditorReady(page);
  await page.getByRole("button", {name: "All tasks"}).click();
  await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
}

async function waitForTaskEditorReady(page) {
  await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
  await page.waitForFunction(() => {
    const textarea = document.querySelector('textarea[aria-label="User JavaScript code"]');
    const editor = (window.monaco?.editor.getEditors() ?? []).find(candidate => candidate.getDomNode()?.contains(textarea));
    return Boolean(editor?.getModel() && document.querySelector(".monaco-editor .view-lines"));
  });
  await page.waitForLoadState("networkidle");
}

async function fillTaskForm(page, record) {
  await page.getByRole("button", {name: "New task"}).click();
  await page.getByLabel("Task ID").fill(record.id);
  await page.getByLabel("Title").fill(record.title);
  await page.getByLabel("Description").fill(record.description);
  await page.getByLabel("Entry point").fill(record.entryPoint);
  await page.getByLabel("Starter code").fill(record.starterCode);
  await page.getByLabel("Reference solution").fill(record.solution);
  await page.getByLabel("Tests (JSON)").fill(JSON.stringify(record.tests));
  if (record.topic) await page.getByLabel("Topic (optional)").selectOption(record.topic);
}

function rows(page) {
  return page.locator("main ul > li");
}

function customAlerts(page) {
  return page.locator('section[aria-label="Custom tasks"]').getByRole("alert");
}

async function activeDraft(page) {
  return page.evaluate(() => {
    const textarea = document.querySelector('textarea[aria-label="User JavaScript code"]');
    return (window.monaco?.editor.getEditors() ?? []).find(editor => editor.getDomNode()?.contains(textarea))?.getModel()?.getValue() ?? null;
  });
}

async function assertActiveDraft(page, expected, message) {
  await page.waitForFunction(expected => {
    const textarea = document.querySelector('textarea[aria-label="User JavaScript code"]');
    return (window.monaco?.editor.getEditors() ?? []).find(editor => editor.getDomNode()?.contains(textarea))?.getModel()?.getValue() === expected;
  }, expected);
  assert.equal(await activeDraft(page), expected, message);
}

async function outputText(page, expected) {
  const outputPanel = page.getByRole("heading", {name: "Output"}).locator("..");
  const output = outputPanel.locator("pre");
  await output.waitFor({state: "visible"});
  await page.waitForFunction(({expected, heading}) => {
    const panel = Array.from(document.querySelectorAll("h2")).find(node => node.textContent?.trim() === heading)?.parentElement;
    return panel?.querySelector("pre")?.textContent?.trim() === expected;
  }, {expected, heading: "Output"});
  return (await output.innerText()).trim();
}

async function setActiveDraft(page, previous, next) {
  await page.getByLabel(/Показать решение|Показано решение/).click();
  const actual = await page.evaluate(({previous, next}) => {
    const model = (window.monaco?.editor.getModels() ?? []).find(candidate => candidate.getValue() === previous);
    if (!model) return null;
    model.setValue(next);
    return model.getValue();
  }, {previous, next});
  assert.equal(actual, next, "the visible custom Monaco model receives the inert fixture without execution");
}

test("custom task controls validate accessibly, persist only custom definitions, and join real catalogue filters", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const seen = await diagnostics(page);
  const tagged = customTask("custom-arrays", {topic: "Arrays"});
  const legacy = customTask("custom-legacy");

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    const builtInCount = await rows(page).count();

    await page.getByRole("button", {name: "New task"}).click();
    await page.getByRole("button", {name: "Save task"}).click();
    const invalidAlert = customAlerts(page);
    await invalidAlert.waitFor({state: "visible"});
    assert.match(await invalidAlert.innerText(), /task|field|required|invalid/i, "invalid input is visibly announced");
    assert.equal(await page.getByLabel("Task ID").evaluate(node => node === document.activeElement), true, "invalid submission returns keyboard focus to the first invalid field");
    assert.equal(await rows(page).count(), builtInCount, "malformed form data remains unsaved");

    await fillTaskForm(page, tagged);
    await page.getByRole("button", {name: "Save task"}).click();
    const taggedRow = rows(page).filter({hasText: tagged.title});
    await taggedRow.waitFor({state: "visible"});
    assert.match(await taggedRow.innerText(), /Arrays/, "a tagged custom record is a real catalogue row");
    assert.equal(await page.getByRole("radio", {name: "Uncategorized", exact: true}).count(), 0, "the optional Uncategorized filter stays absent without an untagged custom row");

    await fillTaskForm(page, legacy);
    await page.getByRole("button", {name: "Save task"}).click();
    const legacyRow = rows(page).filter({hasText: legacy.title});
    await legacyRow.waitFor({state: "visible"});
    assert.match(await legacyRow.innerText(), /Uncategorized/, "a legacy no-topic record uses the neutral label");
    assert.equal(await page.getByRole("radio", {name: "Uncategorized", exact: true}).count(), 1, "the conditional Uncategorized filter appears only when an untagged custom record exists");

    const search = page.getByRole("searchbox", {name: "Search tasks"});
    await search.fill("custom-arrays");
    assert.equal(await rows(page).count(), 1, "custom rows participate in the same search collection");
    await page.getByRole("radio", {name: "Arrays", exact: true}).check();
    assert.equal(await rows(page).count(), 1, "custom rows participate in the same topic filter");
    await page.getByRole("radio", {name: "Not started", exact: true}).check();
    assert.equal(await rows(page).count(), 1, "custom rows participate in the same status filter");
    await page.getByRole("radio", {name: "All statuses", exact: true}).check();
    await page.getByRole("radio", {name: "All topics", exact: true}).check();
    await search.fill("");

    const savedBeforeReload = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    assert.deepEqual(savedBeforeReload, {version: 1, tasks: [tagged, legacy]}, "only custom definitions are persisted in the versioned key");
    await page.waitForLoadState("networkidle");
    await page.reload({waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: tagged.title}).waitFor({state: "visible"});
    await rows(page).filter({hasText: legacy.title}).waitFor({state: "visible"});

    await rows(page).filter({hasText: tagged.title}).getByRole("button", {name: /^Open(?: |$)/}).click();
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await assertActiveDraft(page, tagged.starterCode, "Open selects the persisted custom task through the existing workspace");
    const editedDraft = "function echo(value) { return `${value}`; }";
    await setActiveDraft(page, tagged.starterCode, editedDraft);
    await page.getByRole("button", {name: "Test Code"}).click();
    const actualResult = await outputText(page, "Все тесты пройдены: 1/1");
    assert.match(actualResult, /1\/1/, "the inert custom task reaches a real Test result before catalogue navigation");
    await page.getByLabel(/Показать информацию|Показана информация/).click();
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "Back to task"}).click();
    assert.match(await page.getByLabel(/Показана информация/).getAttribute("aria-label"), /Показана информация/, "Back preserves the custom task's active tab");
    await assertActiveDraft(page, editedDraft, "Back preserves the custom draft without a second state owner");
    assert.equal(await outputText(page, actualResult), actualResult, "Back preserves the custom task's actual result");

    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET", "GET"], "the reload reaches one inert catalogue GET per document");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("JSON import/export are custom-only and rejected documents preserve browser prestate", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const seen = await diagnostics(page);
  const existing = customTask("existing", {topic: "Logic"});
  const legacy = customTask("legacy-import");

  try {
    await page.addInitScript(({key, existing}) => localStorage.setItem(key, JSON.stringify({version: 1, tasks: [existing]})), {key: storageKey, existing});
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    const before = await page.evaluate(key => localStorage.getItem(key), storageKey);

    const badFile = page.getByLabel("Import tasks JSON");
    await badFile.setInputFiles({name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{")});
    const alert = customAlerts(page);
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /import|JSON|invalid|error/i, "malformed import is visibly recoverable");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), before, "malformed import cannot partially mutate browser storage");

    await badFile.setInputFiles({name: "collision.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({version: 1, tasks: [customTask("race")]}))});
    await alert.waitFor({state: "visible"});
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), before, "built-in collision cannot partially mutate browser storage");

    await badFile.setInputFiles({name: "retry.json", mimeType: "application/json", buffer: Buffer.from("{")});
    await alert.waitFor({state: "visible"});
    await badFile.setInputFiles({name: "retry.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({version: 1, tasks: [legacy]}))});
    await rows(page).filter({hasText: legacy.title}).waitFor({state: "visible"});
    assert.match(await rows(page).filter({hasText: legacy.title}).innerText(), /Uncategorized/, "valid legacy import remains usable");

    const download = page.waitForEvent("download");
    await page.getByRole("button", {name: "Export tasks"}).click();
    const exported = await download;
    const exportedText = await exported.createReadStream().then(async stream => {
      const parts = [];
      for await (const part of stream) parts.push(part);
      return Buffer.concat(parts).toString("utf8");
    });
    assert.deepEqual(JSON.parse(exportedText), {version: 1, tasks: [existing, legacy]}, "export excludes built-in catalogue rows and round-trips custom definitions only");
    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET"], "the browser case reaches exactly one inert catalogue GET");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("a quota failure preserves loaded rows and Retry storage permits a later save", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const existing = customTask("persisted", {topic: "Logic"});
  const incoming = customTask("after-retry", {topic: "Numbers"});
  await context.addInitScript(({key, existing}) => {
    const originalSetItem = Storage.prototype.setItem;
    originalSetItem.call(window.localStorage, key, JSON.stringify({version: 1, tasks: [existing]}));
    window.__blockCustomStorageWrite = false;
    Storage.prototype.setItem = function(storageKey, value) {
      if (window.__blockCustomStorageWrite && storageKey === key) throw new DOMException("quota", "QuotaExceededError");
      return originalSetItem.call(this, storageKey, value);
    };
  }, {key: storageKey, existing});
  const page = await context.newPage();
  const seen = await diagnostics(page);

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    const before = await page.evaluate(key => localStorage.getItem(key), storageKey);
    await page.evaluate(() => { window.__blockCustomStorageWrite = true; });
    await fillTaskForm(page, incoming);
    await page.getByRole("button", {name: "Save task"}).click();
    const alert = customAlerts(page);
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /storage|quota|save|error/i, "quota failure is visibly recoverable");
    assert.equal(await rows(page).filter({hasText: existing.title}).count(), 1, "failed persistence retains loaded custom rows");
    assert.equal(await rows(page).filter({hasText: incoming.title}).count(), 0, "failed persistence does not add an in-memory row");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), before, "quota failure preserves the existing custom document");

    await page.evaluate(() => { window.__blockCustomStorageWrite = false; });
    await page.getByRole("button", {name: "Retry storage"}).click();
    await page.getByRole("button", {name: "Save task"}).click();
    await rows(page).filter({hasText: incoming.title}).waitFor({state: "visible"});
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey), {version: 1, tasks: [existing, incoming]}, "a retry followed by save recovers append-only persistence");

    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET"], "the recovery case reaches exactly one inert catalogue GET");
  } finally {
    await context.close();
    await browser.close();
  }
});
