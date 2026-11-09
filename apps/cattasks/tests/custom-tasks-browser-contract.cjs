const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:3002";
const legacyStorageKey = "cattasks.custom-tasks.v1";
const databaseName = "cattasks.custom-tasks";
const storeName = "documents";
const documentKey = "v1";
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

async function storedDocument(page) {
  return page.evaluate(({databaseName, storeName, documentKey}) => new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(documentKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error);
    };
  }), {databaseName, storeName, documentKey});
}

async function storedTasks(page) {
  const value = await storedDocument(page);
  return value === null ? null : JSON.parse(value).tasks;
}

async function holdDocumentTransaction(page) {
  await page.evaluate(({databaseName, storeName, documentKey}) => new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      let released = false;
      let anchored = false;
      let resolveCompletion;
      let rejectCompletion;
      const completion = new Promise((resolve, reject) => {
        resolveCompletion = resolve;
        rejectCompletion = reject;
      });
      completion.catch(() => undefined);
      window.__customTaskTransactionHeld = false;
      window.__releaseCustomTaskTransaction = () => { released = true; };
      window.__customTaskTransactionCompletion = completion;
      const keepAlive = () => {
        const request = store.get(documentKey);
        request.onerror = () => {
          if (!anchored) reject(request.error);
        };
        request.onsuccess = () => {
          if (!anchored) {
            anchored = true;
            window.__customTaskTransactionHeld = true;
            resolve();
          }
          if (released) return;
          keepAlive();
        };
      };
      keepAlive();
      transaction.oncomplete = () => {
        window.__customTaskTransactionHeld = false;
        database.close();
        resolveCompletion();
      };
      transaction.onabort = () => {
        window.__customTaskTransactionHeld = false;
        database.close();
        rejectCompletion(transaction.error);
        if (!anchored) reject(transaction.error);
      };
      transaction.onerror = () => undefined;
    };
  }), {databaseName, storeName, documentKey});
}

async function releaseDocumentTransaction(page) {
  await page.evaluate(async () => {
    window.__releaseCustomTaskTransaction?.();
    await window.__customTaskTransactionCompletion;
  });
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

async function delayCatalogue(page) {
  let fulfill;
  const released = new Promise(resolve => { fulfill = resolve; });
  const catalogMethods = [];
  await page.route("**/task-catalog.v1.json", async route => {
    catalogMethods.push(route.request().method());
    await released;
    await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });
  return {catalogMethods, release: () => fulfill()};
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

test("the route performs one initial custom-task storage initialization", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  await context.addInitScript(databaseName => {
    const nativeIndexedDb = window.indexedDB;
    let opens = 0;
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        return new Proxy(nativeIndexedDb, {
          get(target, property) {
            if (property === "open") {
              return (...args) => {
                if (args[0] === databaseName) opens += 1;
                return target.open(...args);
              };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    });
    window.__customTaskInitialOpenCount = () => opens;
  }, databaseName);
  const page = await context.newPage();
  const seen = await diagnostics(page);

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    const exportButton = page.getByRole("button", {name: "Export tasks"});
    await exportButton.waitFor({state: "visible"});
    await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(button => button.textContent?.trim() === "Export tasks" && !button.disabled));
    await page.waitForFunction(() => window.__customTaskInitialOpenCount() > 0);
    assert.equal(await page.evaluate(() => window.__customTaskInitialOpenCount()), 1, "the route initializes custom-task storage through one provider");
    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET"]);
  } finally {
    await context.close();
    await browser.close();
  }
});

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
    await page.waitForFunction(() => document.activeElement === document.querySelector('input[id="custom-task-id"]'));
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

    assert.deepEqual(await storedTasks(page), [tagged, legacy], "only custom definitions are persisted in the versioned IndexedDB document");
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
    await page.getByLabel(/Hint: Показать подсказки|Hint: Показаны подсказки/).click();
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "Back to task"}).click();
    assert.match(await page.getByLabel(/Hint: Показаны подсказки/).getAttribute("aria-label"), /Показаны подсказки/, "Back preserves the custom task's active tab");
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
    await page.addInitScript(({key, existing}) => localStorage.setItem(key, JSON.stringify({version: 1, tasks: [existing]})), {key: legacyStorageKey, existing});
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    const legacyBefore = await page.evaluate(key => localStorage.getItem(key), legacyStorageKey);
    const before = await storedDocument(page);

    const badFile = page.getByLabel("Import tasks JSON");
    await badFile.setInputFiles({name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{")});
    const alert = customAlerts(page);
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /import|JSON|invalid|error/i, "malformed import is visibly recoverable");
    assert.equal(await storedDocument(page), before, "malformed import cannot partially mutate the IndexedDB document");

    await badFile.setInputFiles({name: "collision.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({version: 1, tasks: [customTask("race")]}))});
    await alert.waitFor({state: "visible"});
    assert.equal(await storedDocument(page), before, "built-in collision cannot partially mutate the IndexedDB document");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), legacyBefore, "legacy data remains untouched after migration and rejected imports");

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
    assert.deepEqual(JSON.parse(exportedText), {version: 1, tasks: [existing, legacy]}, "export reads only the IndexedDB custom-task snapshot");
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

test("legacy migration retains the raw v1 document and IndexedDB remains authoritative after reload", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const existing = customTask("persisted", {topic: "Logic"});
  const added = customTask("after-migration", {topic: "Numbers"});
  const legacyRaw = JSON.stringify({version: 1, tasks: [existing]});
  await context.addInitScript(({key, legacyRaw}) => localStorage.setItem(key, legacyRaw), {key: legacyStorageKey, legacyRaw});
  const page = await context.newPage();
  const seen = await diagnostics(page);
  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), legacyRaw, "migration never rewrites the original legacy document");
    assert.deepEqual(await storedTasks(page), [existing], "the first load commits the validated legacy snapshot to IndexedDB");
    await fillTaskForm(page, added);
    await page.getByRole("button", {name: "Save task"}).click();
    await rows(page).filter({hasText: added.title}).waitFor({state: "visible"});
    await page.reload({waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    await rows(page).filter({hasText: added.title}).waitFor({state: "visible"});
    assert.deepEqual(await storedTasks(page), [existing, added], "reload reads the committed IndexedDB document without remigrating duplicates");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), legacyRaw, "subsequent appends keep legacy bytes untouched");
    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET", "GET"]);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("a delayed import uses current readiness and export stays blocked until the first successful storage read", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const existing = customTask("saved-before-ready", {topic: "Logic"});
  const delayed = customTask("delayed-after-ready", {topic: "Arrays"});
  await page.addInitScript(({key, existing}) => localStorage.setItem(key, JSON.stringify({version: 1, tasks: [existing]})), {key: legacyStorageKey, existing});
  await page.addInitScript(() => {
    const original = File.prototype.text;
    window.__releaseDelayedImport = null;
    File.prototype.text = function() {
      return new Promise((resolve, reject) => {
        window.__releaseDelayedImport = () => original.call(this).then(resolve, reject);
      });
    };
  });
  const seen = await diagnostics(page);
  const delayedCatalog = await delayCatalogue(page);

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
    const exportButton = page.getByRole("button", {name: "Export tasks"});
    await exportButton.waitFor({state: "visible"});
    assert.equal(await exportButton.isDisabled(), true, "export cannot create an empty backup before the saved custom document has been read");

    const input = page.getByLabel("Import tasks JSON");
    await input.setInputFiles({name: "delayed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({version: 1, tasks: [delayed]}))});
    delayedCatalog.release();
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    await page.waitForFunction(() => typeof window.__releaseDelayedImport === "function");
    await page.evaluate(() => window.__releaseDelayedImport());
    await rows(page).filter({hasText: delayed.title}).waitFor({state: "visible"});
    assert.equal(await exportButton.isDisabled(), false, "a successful initial read, including a nonempty saved collection, enables export");
    assert.deepEqual(await storedTasks(page), [existing, delayed], "the delayed file is validated against current catalogue and repository state, not the stale pre-load render");
    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(delayedCatalog.catalogMethods, ["GET"]);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("two queued IndexedDB appends commit both tasks and a fresh third page reads both", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const firstPage = await context.newPage();
  const secondPage = await context.newPage();
  const firstSeen = await diagnostics(firstPage);
  const secondSeen = await diagnostics(secondPage);
  const first = customTask("first-tab-task", {topic: "Arrays"});
  const second = customTask("second-tab-task", {topic: "Strings"});

  try {
    await Promise.all([firstPage.goto(baseUrl, {waitUntil: "domcontentloaded"}), secondPage.goto(baseUrl, {waitUntil: "domcontentloaded"})]);
    await Promise.all([openCatalogue(firstPage), openCatalogue(secondPage)]);
    await holdDocumentTransaction(firstPage);
    assert.equal(await firstPage.evaluate(() => window.__customTaskTransactionHeld), true, "the holder has completed an actual IndexedDB read and remains active before either append is scheduled");
    await Promise.all([
      fillTaskForm(firstPage, first).then(() => firstPage.getByRole("button", {name: "Save task"}).click()),
      fillTaskForm(secondPage, second).then(() => secondPage.getByRole("button", {name: "Save task"}).click()),
    ]);
    assert.equal(await rows(firstPage).filter({hasText: first.title}).count(), 0, "the held real IndexedDB transaction prevents the first UI append from completing");
    assert.equal(await rows(secondPage).filter({hasText: second.title}).count(), 0, "the held real IndexedDB transaction prevents the second UI append from completing");
    await releaseDocumentTransaction(firstPage);
    await Promise.all([
      rows(firstPage).filter({hasText: first.title}).waitFor({state: "visible"}),
      rows(secondPage).filter({hasText: second.title}).waitFor({state: "visible"}),
    ]);
    const thirdPage = await context.newPage();
    const thirdSeen = await diagnostics(thirdPage);
    await thirdPage.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(thirdPage);
    await rows(thirdPage).filter({hasText: first.title}).waitFor({state: "visible"});
    await rows(thirdPage).filter({hasText: second.title}).waitFor({state: "visible"});
    assert.deepEqual((await storedTasks(thirdPage)).map(task => task.id).sort(), [first.id, second.id].sort(), "a fresh page reads both committed records after the forced transaction queue");
    for (const seen of [firstSeen, secondSeen, thirdSeen]) {
      assert.deepEqual(seen.consoleErrors, []);
      assert.deepEqual(seen.pageErrors, []);
      assert.deepEqual(seen.failedRequests, []);
      assert.deepEqual(seen.failedResponses, []);
      assert.deepEqual(seen.catalogMethods, ["GET"]);
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("aborted and rejected IndexedDB document writes never publish a task, and Retry permits a later commit", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const existing = customTask("failure-existing", {topic: "Logic"});
  const incoming = customTask("failure-incoming", {topic: "Numbers"});
  const legacyRaw = JSON.stringify({version: 1, tasks: [existing]});
  await context.addInitScript(({legacyStorageKey, legacyRaw, storeName, documentKey}) => {
    localStorage.setItem(legacyStorageKey, legacyRaw);
    const nativePut = IDBObjectStore.prototype.put;
    window.__abortNextCustomTaskWrite = false;
    window.__rejectNextCustomTaskWrite = false;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === storeName && key === documentKey) {
        if (window.__abortNextCustomTaskWrite) {
          window.__abortNextCustomTaskWrite = false;
          const request = nativePut.call(this, value, key);
          request.addEventListener("success", () => this.transaction.abort(), {once: true});
          return request;
        }
        if (window.__rejectNextCustomTaskWrite) {
          window.__rejectNextCustomTaskWrite = false;
          throw new DOMException("quota", "QuotaExceededError");
        }
      }
      return nativePut.call(this, value, key);
    };
  }, {legacyStorageKey, legacyRaw, storeName, documentKey});
  const page = await context.newPage();
  const seen = await diagnostics(page);

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    const before = await storedDocument(page);

    await fillTaskForm(page, incoming);
    await page.evaluate(() => { window.__abortNextCustomTaskWrite = true; });
    await page.getByRole("button", {name: "Save task"}).click();
    const alert = customAlerts(page);
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /storage|save|abort|error/i, "an aborted transaction is announced as a recoverable save failure");
    assert.equal(await rows(page).filter({hasText: incoming.title}).count(), 0, "an aborted transaction cannot publish an in-memory task");
    assert.equal(await storedDocument(page), before, "an aborted transaction leaves the committed document byte-for-byte unchanged");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), legacyRaw, "an aborted transaction leaves legacy bytes untouched");

    await page.getByRole("button", {name: "Retry storage"}).click();
    await page.evaluate(() => { window.__rejectNextCustomTaskWrite = true; });
    await page.getByRole("button", {name: "Save task"}).click();
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /storage|quota|save|error/i, "a synchronous IndexedDB write rejection is recoverable");
    assert.equal(await storedDocument(page), before, "a rejected document write cannot commit a valid prefix");

    await page.getByRole("button", {name: "Retry storage"}).click();
    await page.getByRole("button", {name: "Save task"}).click();
    await rows(page).filter({hasText: incoming.title}).waitFor({state: "visible"});
    assert.deepEqual(await storedTasks(page), [existing, incoming], "a later valid retry commits exactly one complete document");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), legacyRaw, "a recovered commit still does not rewrite legacy data");
    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET"]);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("an unavailable initial IndexedDB open blocks export until Retry migrates the untouched legacy document", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const existing = customTask("open-retry-existing", {topic: "Strings"});
  const legacyRaw = JSON.stringify({version: 1, tasks: [existing]});
  await context.addInitScript(({legacyStorageKey, legacyRaw}) => {
    localStorage.setItem(legacyStorageKey, legacyRaw);
    const nativeIndexedDb = window.indexedDB;
    window.__rejectCustomTaskOpen = true;
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        if (window.__rejectCustomTaskOpen) throw new DOMException("unavailable", "InvalidStateError");
        return nativeIndexedDb;
      },
    });
  }, {legacyStorageKey, legacyRaw});
  const page = await context.newPage();
  const seen = await diagnostics(page);

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    const exportButton = page.getByRole("button", {name: "Export tasks"});
    await exportButton.waitFor({state: "visible"});
    assert.equal(await exportButton.isDisabled(), true, "export stays disabled until an initial repository read succeeds");
    const alert = customAlerts(page);
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /storage|unavailable|error/i, "an unavailable initial repository is visibly recoverable");
    assert.equal(await rows(page).filter({hasText: existing.title}).count(), 0, "a failed initial open does not publish legacy rows in memory");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), legacyRaw, "an unavailable open leaves legacy bytes untouched");

    await page.evaluate(() => { window.__rejectCustomTaskOpen = false; });
    await page.getByRole("button", {name: "Retry storage"}).click();
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    assert.equal(await exportButton.isDisabled(), false, "a successful Retry enables export after migration");
    assert.deepEqual(await storedTasks(page), [existing], "Retry commits the validated legacy document as the repository source");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), legacyRaw, "Retry preserves legacy bytes exactly");
    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET"]);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("a committed import publishes its row after its controls unmount too late to roll back", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const committed = customTask("late-commit-import", {topic: "Logic"});
  await context.addInitScript(({databaseName, storeName, documentKey}) => {
    const nativePut = IDBObjectStore.prototype.put;
    const nativeAbort = IDBTransaction.prototype.abort;
    window.__lateCommitArmed = false;
    window.__lateCommitPutSucceeded = false;
    window.__lateCommitBackClicked = false;
    window.__lateCommitAbortName = null;
    window.__lateCommitTransaction = null;
    IDBTransaction.prototype.abort = function() {
      if (this !== window.__lateCommitTransaction) return nativeAbort.call(this);
      try {
        return nativeAbort.call(this);
      } catch (error) {
        window.__lateCommitAbortName = error instanceof DOMException ? error.name : String(error);
        throw error;
      }
    };
    IDBObjectStore.prototype.put = function(value, key) {
      if (
        window.__lateCommitArmed &&
        this.name === storeName &&
        key === documentKey &&
        this.transaction.db.name === databaseName
      ) {
        window.__lateCommitArmed = false;
        const transaction = this.transaction;
        const request = nativePut.call(this, value, key);
        request.addEventListener("success", () => {
          window.__lateCommitPutSucceeded = true;
          window.__lateCommitTransaction = transaction;
          transaction.commit();
          const back = Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Back to task"));
          window.__lateCommitBackClicked = Boolean(back);
          back?.click();
        }, {once: true});
        return request;
      }
      return nativePut.call(this, value, key);
    };
  }, {databaseName, storeName, documentKey});
  const page = await context.newPage();
  const seen = await diagnostics(page);

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await waitForTaskEditorReady(page);
    const originalDraft = await activeDraft(page);
    const preservedDraft = "function echo(value) { return `${value}`; }";
    await setActiveDraft(page, originalDraft, preservedDraft);
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});

    await page.evaluate(() => { window.__lateCommitArmed = true; });
    await page.getByLabel("Import tasks JSON").setInputFiles({
      name: "late-commit.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({version: 1, tasks: [committed]})),
    });
    await page.waitForFunction(() => window.__lateCommitAbortName === "InvalidStateError");
    assert.equal(await page.evaluate(() => window.__lateCommitPutSucceeded), true, "the native custom-task put succeeds before cancellation is requested");
    assert.equal(await page.evaluate(() => window.__lateCommitBackClicked), true, "the actual Back control unmounts the import controls while the Provider remains mounted");
    assert.equal(await page.evaluate(() => window.__lateCommitAbortName), "InvalidStateError", "the controls' AbortSignal reaches a committing native transaction too late to roll it back");
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await assertActiveDraft(page, preservedDraft, "the obsolete import leaves the current selection and draft untouched");
    assert.deepEqual(await storedTasks(page), [committed], "the committed import is retained in the authoritative IndexedDB document");

    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
    await rows(page).filter({hasText: committed.title}).waitFor({state: "visible"});
    assert.equal(await rows(page).filter({hasText: committed.title}).count(), 1, "the mounted Provider publishes the committed row without reload or Retry");
    assert.equal(await customAlerts(page).count(), 0, "the obsolete import caller does not revive a stale error after its controls unmount");
    assert.deepEqual(seen.consoleErrors, []);
    assert.deepEqual(seen.pageErrors, []);
    assert.deepEqual(seen.failedRequests, []);
    assert.deepEqual(seen.failedResponses, []);
    assert.deepEqual(seen.catalogMethods, ["GET"]);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("a legacy custom document colliding with a loaded built-in is quarantined and exported byte-for-byte without migration", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const collision = customTask("ct-js-01");
  const companion = customTask("collision-companion");
  const raw = ` {\n  "version": 1,\n  "tasks": [${JSON.stringify(collision)},${JSON.stringify(companion)}]\n}\n`;
  const collisionCatalog = {version: 1, tasks: [
    {id: "ct-js-01", slug: "builtin-collision", title: "Built-in collision", description: "Inert built-in fixture.", hints: ["Read the input.", "Return a JSON value."], entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["built-in"], expected: "built-in"}], solutions: [{id: "reference", label: "Reference", code: "function echo(value) { return value; }", timeComplexity: "O(1)", spaceComplexity: "O(1)", rationale: "One return."}], difficulty: "Easy"},
  ]};
  await context.addInitScript(({legacyStorageKey, raw}) => localStorage.setItem(legacyStorageKey, raw), {legacyStorageKey, raw});
  const page = await context.newPage();
  const putCalls = [];
  await page.addInitScript(({databaseName, storeName, documentKey}) => {
    const nativePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.transaction.db.name === databaseName && this.name === storeName && key === documentKey) window.__collisionPutCalls = (window.__collisionPutCalls ?? 0) + 1;
      return nativePut.call(this, value, key);
    };
  }, {databaseName, storeName, documentKey});
  await page.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(collisionCatalog)}));
  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    const alert = customAlerts(page);
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /collides with a built-in/i, "the failed reread quarantines the collision before publishing custom rows");
    assert.equal(await rows(page).filter({hasText: companion.title}).count(), 0, "a companion is not activated from a collision document");
    assert.equal(await page.getByRole("button", {name: "New task"}).isDisabled(), true, "mutating controls remain blocked during recovery");
    assert.equal(await page.getByLabel("Import tasks JSON").isDisabled(), true, "import remains blocked during recovery");
    const recovery = page.getByRole("button", {name: "Export recovery JSON"});
    assert.equal(await recovery.isDisabled(), false, "only the raw recovery export is enabled");
    const download = page.waitForEvent("download");
    await recovery.click();
    const saved = await download;
    assert.equal(await saved.createReadStream().then(async stream => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks).toString("utf8"); }), raw, "recovery export preserves the original DOM string exactly rather than parse/reserialize");
    putCalls.push(await page.evaluate(() => window.__collisionPutCalls ?? 0));
    assert.deepEqual(putCalls, [0], "collision recovery neither initializes nor migrates the stored document");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), raw, "legacy bytes remain untouched");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("ordinary malformed and duplicate storage documents remain errors without a recovery export", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  try {
    const duplicateSolutionId = customTask("duplicate-solution-id", {solutions: [
      {id: "reference", label: "First reference", code: "function echo(value) { return String(value); }", timeComplexity: "O(1)", spaceComplexity: "O(1)", rationale: "Returns one value."},
      {id: "reference", label: "Second reference", code: "function echo(value) { return String(value); }", timeComplexity: "O(1)", spaceComplexity: "O(1)", rationale: "Returns one value."},
    ]});
    for (const raw of ["{", JSON.stringify({version: 1, tasks: [customTask("duplicate"), customTask("duplicate")]}), JSON.stringify({version: 1, tasks: [duplicateSolutionId]})]) {
      const context = await browser.newContext();
      await context.addInitScript(({legacyStorageKey, raw}) => localStorage.setItem(legacyStorageKey, raw), {legacyStorageKey, raw});
      const page = await context.newPage();
      await page.addInitScript(({databaseName, storeName, documentKey}) => {
        const nativePut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value, key) {
          if (this.transaction.db.name === databaseName && this.name === storeName && key === documentKey) window.__ordinaryInvalidPutCalls = (window.__ordinaryInvalidPutCalls ?? 0) + 1;
          return nativePut.call(this, value, key);
        };
      }, {databaseName, storeName, documentKey});
      await diagnostics(page);
      try {
        await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
        await openCatalogue(page);
        await customAlerts(page).waitFor({state: "visible"});
        assert.equal(await page.getByRole("button", {name: "Export recovery JSON"}).count(), 0, "only a structurally valid built-in collision gets a raw recovery export");
        assert.equal(await page.getByRole("button", {name: "Export tasks"}).isDisabled(), true, "ordinary invalid storage cannot be exported as a normal custom snapshot");
        assert.equal(await page.getByRole("button", {name: "New task"}).isDisabled(), true, "ordinary invalid storage also blocks mutation until a valid reread");
        assert.equal(await page.getByLabel("Import tasks JSON").isDisabled(), true, "ordinary invalid storage also blocks import until a valid reread");
        assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey), raw, "ordinary invalid storage bytes remain unchanged");
        assert.equal(await page.evaluate(() => window.__ordinaryInvalidPutCalls ?? 0), 0, "ordinary invalid storage never initializes or mutates the document repository");
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test("an external collision reread quarantines a previously selected custom workspace before recovery export", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const existing = customTask("selected-before-collision");
  const collision = customTask("race");
  const companion = customTask("companion-after-collision");
  const collisionRaw = JSON.stringify({version: 1, tasks: [collision, companion]});
  await context.addInitScript(({legacyStorageKey, existing}) => localStorage.setItem(legacyStorageKey, JSON.stringify({version: 1, tasks: [existing]})), {legacyStorageKey, existing});
  const page = await context.newPage();
  const seen = await diagnostics(page);
  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).waitFor({state: "visible"});
    await rows(page).filter({hasText: existing.title}).getByRole("button", {name: /^Open(?: |$)/}).click();
    const draft = "function echo(value) { return `${value}`; }";
    await setActiveDraft(page, existing.starterCode, draft);
    await page.getByRole("button", {name: "Test Code"}).click();
    const resultBefore = await outputText(page, "Все тесты пройдены: 1/1");
    await page.getByLabel(/Hint: Показать подсказки|Hint: Показаны подсказки/).click();
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});

    await page.evaluate(({databaseName, storeName, documentKey, collisionRaw}) => new Promise((resolve, reject) => {
      const open = indexedDB.open(databaseName);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(collisionRaw, documentKey);
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onabort = () => reject(transaction.error);
      };
    }), {databaseName, storeName, documentKey, collisionRaw});

    await fillTaskForm(page, customTask("trigger-reread"));
    await page.getByRole("button", {name: "Save task"}).click();
    const alert = customAlerts(page);
    await alert.waitFor({state: "visible"});
    assert.match(await alert.innerText(), /collides with a built-in/i, "the real append observes the externally replaced document and exposes a retry path");
    assert.equal(await rows(page).filter({hasText: existing.title}).count(), 1, "a failed mutation alone retains the last validated projection until the actual reread");
    await page.getByRole("button", {name: "Retry storage"}).click();
    await page.waitForFunction(title => !Array.from(document.querySelectorAll("main li")).some(node => node.textContent?.includes(title)), existing.title);
    assert.equal(await rows(page).filter({hasText: existing.title}).count(), 0, "the collision reread clears the old selected custom row before reporting recovery");
    assert.equal(await rows(page).filter({hasText: companion.title}).count(), 0, "a companion in the collision document is not activated");
    assert.equal(await page.getByRole("button", {name: "New task"}).isDisabled(), true, "reread recovery blocks fresh mutations");
    assert.equal(await page.getByLabel("Import tasks JSON").isDisabled(), true, "reread recovery blocks import");
    const download = page.waitForEvent("download");
    await page.getByRole("button", {name: "Export recovery JSON"}).click();
    const exported = await download;
    const raw = await exported.createReadStream().then(async stream => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks).toString("utf8"); });
    assert.equal(raw, collisionRaw, "recovery retains the exact external raw document after the selected workspace is quarantined");
    await page.getByRole("button", {name: "Back to task"}).click();
    assert.equal(await page.getByRole("button", {name: "Test Code"}).isDisabled(), true, "a stale custom workspace never rebinds after collision reread");
    assert.equal(await page.getByRole("button", {name: "Run Code"}).isDisabled(), true, "collision reread leaves execution unavailable without a selected valid task");
    assert.equal(await page.getByRole("combobox").inputValue(), "", "collision reread clears the selected custom label rather than selecting a built-in by matching ID");
    assert.equal(await outputText(page, "Run code or tests to see output."), "Run code or tests to see output.", "collision reread clears stale custom output ownership while preserving the protected editor shell");
    assert.equal(resultBefore, "Все тесты пройдены: 1/1", "the connected history establishes a real result before its custom workspace is quarantined");
    assert.deepEqual(seen.consoleErrors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("a pending valid reread blocks writes while retaining the last validated selected custom workspace", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const existing = customTask("pending-reread-selected");
  const validRaw = JSON.stringify({version: 1, tasks: [existing]});
  await context.addInitScript(({legacyStorageKey, validRaw}) => localStorage.setItem(legacyStorageKey, validRaw), {legacyStorageKey, validRaw});
  const page = await context.newPage();
  const seen = await diagnostics(page);
  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await openCatalogue(page);
    await rows(page).filter({hasText: existing.title}).getByRole("button", {name: /^Open(?: |$)/}).click();
    const draft = "function echo(value) { return `${value}`; }";
    await setActiveDraft(page, existing.starterCode, draft);
    await page.getByRole("button", {name: "Test Code"}).click();
    await outputText(page, "Все тесты пройдены: 1/1");
    await page.getByLabel(/Hint: Показать подсказки|Hint: Показаны подсказки/).click();
    await page.getByRole("button", {name: "All tasks"}).click();

    await page.evaluate(({databaseName, storeName, documentKey}) => new Promise((resolve, reject) => {
      const open = indexedDB.open(databaseName); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction(storeName, "readwrite"); tx.objectStore(storeName).put("{", documentKey); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
    }), {databaseName, storeName, documentKey});
    await fillTaskForm(page, customTask("trigger-invalid-reread"));
    await page.getByRole("button", {name: "Save task"}).click();
    await customAlerts(page).waitFor({state: "visible"});
    assert.equal(await rows(page).filter({hasText: existing.title}).count(), 1, "the append failure keeps the last validated projection until a normal reread begins");

    await page.evaluate(({databaseName, storeName, documentKey, validRaw}) => new Promise((resolve, reject) => {
      const open = indexedDB.open(databaseName); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction(storeName, "readwrite"); tx.objectStore(storeName).put(validRaw, documentKey); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
    }), {databaseName, storeName, documentKey, validRaw});
    await holdDocumentTransaction(page);
    await page.getByRole("button", {name: "Retry storage"}).click();
    assert.equal(await page.getByRole("button", {name: "New task"}).isDisabled(), true, "pending reread marks custom storage not-ready before the held read resolves");
    assert.equal(await page.getByLabel("Import tasks JSON").isDisabled(), true, "pending reread blocks import without clearing validated rows");
    assert.equal(await rows(page).filter({hasText: existing.title}).count(), 1, "pending reread retains the old projection rather than transiently clearing it");
    await page.getByRole("button", {name: "Back to task"}).click();
    await assertActiveDraft(page, draft, "pending reread retains the selected custom draft");
    assert.equal(await outputText(page, "Все тесты пройдены: 1/1"), "Все тесты пройдены: 1/1", "pending reread retains the selected custom result");
    assert.match(await page.getByLabel(/Hint: Показаны подсказки/).getAttribute("aria-label"), /Показаны подсказки/, "pending reread retains the active Hint tab");
    await releaseDocumentTransaction(page);
    assert.deepEqual(seen.consoleErrors, []);
  } finally {
    await page.evaluate(() => window.__releaseCustomTaskTransaction?.()).catch(() => undefined);
    await context.close();
    await browser.close();
  }
});
