const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const {selectTaskFromCatalogue} = require("./helpers/catalogue-selection.cjs");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {version: 1, tasks: [
  {id: "saved-a", title: "Saved A", description: "First inert task.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["a"], expected: "a"}]},
  {id: "saved-b", title: "Saved B", description: "Second inert task.", entryPoint: "echo", starterCode: "function echo(value) { return `${value}!`; }", solution: "function echo(value) { return `${value}!`; }", tests: [{args: ["b"], expected: "b!"}]},
]};

function attachDiagnostics(page) {
  const diagnostics = {console: [], page: [], requests: [], responses: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.requests.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.responses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function prepare(page) {
  const diagnostics = attachDiagnostics(page);
  await page.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));
  await page.route("**/language/typescript/tsWorker.js", route => route.fulfill({contentType: "application/javascript", body: "self.onmessage = () => {};"}));
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the isolated CatTasks route responds successfully");
  await page.getByLabel("User JavaScript code").waitFor();
  await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
  return diagnostics;
}

async function replaceDraft(page, current, replacement) {
  const actual = await page.evaluate(({current, replacement}) => {
    const model = (window.monaco?.editor.getModels() ?? []).find(candidate => candidate.getValue() === current);
    if (!model) throw new Error("expected active inert Monaco model is unavailable");
    model.setValue(replacement);
    return model.getValue();
  }, {current, replacement});
  assert.equal(actual, replacement, "the independently controlled inert draft is updated through Monaco");
}

async function editorHas(page, expected) {
  await page.waitForFunction(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), expected);
}

function mySolutionButton(page) {
  return page.getByRole("button", {name: /^My solution/});
}

async function openSavedSolution(page) {
  await mySolutionButton(page).click();
  await page.getByRole("heading", {name: "Saved solution", exact: true}).waitFor();
}

async function savedCodeVisible(page, code) {
  await page.waitForFunction(code => [...document.querySelectorAll("pre")].some(node => node.textContent === code), code);
}

async function assertSavedStatus(page) {
  const status = page.getByRole("status").filter({hasText: "Solution saved."});
  await status.waitFor();
  assert.equal(await status.count(), 1, "Save exposes one persistent success status");
  assert.equal(await status.getAttribute("aria-live"), "polite", "Save success is announced politely");
  return status;
}

async function headerEvidence(page) {
  return page.evaluate(() => {
    const controls = [...document.querySelectorAll("button")].filter(button => /^(Task|Hint|My solution|Hide task)/.test(button.textContent?.trim() ?? ""));
    return controls.map(button => {
      const rect = button.getBoundingClientRect();
      const before = getComputedStyle(button, "::before");
      return {
        text: button.textContent?.trim(),
        width: rect.width,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        eye: button.textContent?.trim() === "Hide task" ? button.querySelectorAll("svg[aria-hidden='true'], [aria-hidden='true'] svg").length : 0,
        eyeBeforeLabel: (() => {
          const eye = button.querySelector("svg[aria-hidden='true'], [aria-hidden='true'] svg");
          const label = [...button.querySelectorAll("span")].find(node => node.textContent?.trim() === "Hide task");
          return Boolean(eye && label && eye.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING);
        })(),
        material: button.getAttribute("data-material"),
        texture: before.backgroundImage,
      };
    });
  });
}

async function assertFourEqualHeaderControls(page, width) {
  await page.setViewportSize({width, height: 900});
  const controls = await headerEvidence(page);
  assert.deepEqual(controls.map(control => control.text), ["Task", "Hint", "My solution", "Hide task"], `header exposes the approved four controls in order at ${width}px`);
  assert.ok(controls.every(control => Math.abs(control.width - controls[0].width) <= .5), `all four task controls have equal outer widths at ${width}px`);
  assert.ok(controls.every(control => control.left >= 0 && control.right <= width), `all four task controls fit at ${width}px`);
  assert.ok(controls.every(control => control.top === controls[0].top && control.bottom === controls[0].bottom), `all four task controls share one row at ${width}px`);
  assert.equal(controls[3].eye, 1, "Hide task presents exactly one decorative eye icon before its text");
  assert.equal(controls[3].eyeBeforeLabel, true, "Hide task places its decorative eye before the visible label");
}

test("CatTasks keeps one saved solution per task, restores only after confirmation, and exposes the approved header controls", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1268, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await assertFourEqualHeaderControls(page, 1268);
    await assertFourEqualHeaderControls(page, 598);
    await assertFourEqualHeaderControls(page, 320);

    await openSavedSolution(page);
    const save = page.getByRole("button", {name: "Save current code", exact: true});
    const restore = page.getByRole("button", {name: "Restore to editor", exact: true});
    assert.equal(await restore.isDisabled(), true, "Restore is unavailable when this task has no snapshot");
    const materials = await page.evaluate(() => [...document.querySelectorAll("button")].filter(button => /^(Save current code|Restore to editor)$/.test(button.textContent?.trim() ?? "")).map(button => ({material: button.getAttribute("data-material"), texture: getComputedStyle(button, "::before").backgroundImage})));
    assert.deepEqual(materials.map(item => item.material), ["wood", "wood"], "Save and Restore reuse the painted-wood material");
    assert.ok(materials.every(item => /painted-wood-grain\.png/.test(item.texture)), "Save and Restore each render the approved wood texture");

    const firstSaved = "function echo(value) { return `saved:${value}`; }";
    await page.getByLabel(/Task:/).click();
    await replaceDraft(page, catalog.tasks[0].starterCode, firstSaved);
    await openSavedSolution(page);
    await save.click();
    await savedCodeVisible(page, firstSaved);
    const savedStatus = await assertSavedStatus(page);
    await savedStatus.evaluate(node => {
      window.__savedSolutionStatusNode = node;
      window.__savedSolutionStatusUpdated = false;
      new MutationObserver(() => { window.__savedSolutionStatusUpdated = true; }).observe(node, {childList: true});
    });
    await save.click();
    await page.waitForFunction(() => window.__savedSolutionStatusUpdated === true);
    const repeatedSaveStatus = await assertSavedStatus(page);
    assert.equal(await repeatedSaveStatus.evaluate(node => node === window.__savedSolutionStatusNode), true, "repeating Save updates the existing public status region rather than replacing it");

    const replacementSaved = "function echo(value) { return `replacement:${value}`; }";
    await page.getByLabel(/Task:/).click();
    await replaceDraft(page, firstSaved, replacementSaved);
    await openSavedSolution(page);
    await save.click();
    await savedCodeVisible(page, replacementSaved);
    assert.equal(await page.locator("pre").filter({hasText: firstSaved}).count(), 0, "a later Save replaces this task's sole earlier snapshot");

    await page.reload({waitUntil: "domcontentloaded"});
    await page.getByLabel("User JavaScript code").waitFor();
    await editorHas(page, catalog.tasks[0].starterCode);
    await openSavedSolution(page);
    await savedCodeVisible(page, replacementSaved);

    await selectTaskFromCatalogue(page, "Saved B");
    await openSavedSolution(page);
    assert.equal(await restore.isDisabled(), true, "a different task cannot restore the first task's snapshot");

    await selectTaskFromCatalogue(page, "Saved A");
    const divergent = "function echo(value) { return `draft:${value}`; }";
    await replaceDraft(page, catalog.tasks[0].starterCode, divergent);
    await openSavedSolution(page);
    let dialogs = 0;
    const dialogDecisions = ["dismiss", "accept"];
    page.on("dialog", async dialog => {
      dialogs += 1;
      const decision = dialogDecisions.shift();
      assert.ok(decision, "equal saved and editor code must not open a third confirmation dialog");
      await dialog[decision]();
    });
    await restore.click();
    await editorHas(page, divergent);
    assert.equal(dialogs, 1, "cancelling the restore confirmation preserves the current editor draft");

    await restore.click();
    await editorHas(page, replacementSaved);
    assert.equal(dialogs, 2, "confirming restore replaces the current editor draft with the saved snapshot");

    await restore.click();
    assert.equal(dialogs, 2, "restore does not ask again when saved and editor code already match");

    const hide = page.getByRole("button", {name: /Hide task/});
    await hide.focus();
    await page.keyboard.press("Space");
    const show = page.getByRole("button", {name: /Show task/});
    assert.equal(await show.evaluate(node => document.activeElement === node), true, "collapsing the panel transfers keyboard focus to Show task");
    await page.keyboard.press("Enter");
    assert.equal(await hide.getAttribute("aria-expanded"), "true", "existing collapsed task control restores the Hide task state");
    assert.equal(await hide.evaluate(node => document.activeElement === node), true, "expanding the collapsed panel restores keyboard focus to Hide task");
    assert.deepEqual(diagnostics, {console: [], page: [], requests: [], responses: []}, "the inert saved-solution flow finishes without browser diagnostics");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks reports saved-solution storage errors and keeps the previous snapshot", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1268, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  await page.addInitScript(() => {
    const storage = Storage.prototype;
    const originalGet = storage.getItem;
    const originalSet = storage.setItem;
    storage.getItem = function(key) {
      if (window.__savedSolutionFailRead && key === window.__savedSolutionTargetKey) throw new DOMException("read unavailable", "SecurityError");
      return originalGet.call(this, key);
    };
    storage.setItem = function(key, value) {
      if (window.__savedSolutionFailWrite && key === window.__savedSolutionTargetKey) throw new DOMException("write unavailable", "QuotaExceededError");
      return originalSet.call(this, key, value);
    };
  });
  try {
    const diagnostics = await prepare(page);
    await openSavedSolution(page);
    const save = page.getByRole("button", {name: "Save current code", exact: true});
    const baseline = "function echo(value) { return `baseline:${value}`; }";
    await page.getByLabel(/Task:/).click();
    await replaceDraft(page, catalog.tasks[0].starterCode, baseline);
    await openSavedSolution(page);
    await save.click();
    await savedCodeVisible(page, baseline);
    await assertSavedStatus(page);
    await page.evaluate(baseline => {
      window.__savedSolutionTargetKey = Object.keys(localStorage).find(key => localStorage.getItem(key) === baseline);
    }, baseline);
    assert.equal(await page.evaluate(() => typeof window.__savedSolutionTargetKey), "string", "the controlled storage boundary targets the actual saved task key");

    await page.evaluate(() => { window.__savedSolutionFailWrite = true; });
    const attempted = "function echo(value) { return `not-stored:${value}`; }";
    await replaceDraft(page, baseline, attempted);
    await save.click();
    const writeError = page.getByRole("alert").filter({hasText: /^This solution could not be saved\.$/});
    await writeError.waitFor();
    assert.equal(await writeError.count(), 1, "a failed write reports the exact save error as an alert");
    assert.equal(await page.getByRole("status").filter({hasText: "Solution saved."}).count(), 0, "a failed Save clears any prior success status");
    assert.equal(await page.locator("pre").filter({hasText: baseline}).count(), 1, "a failed Save retains the previous task snapshot");
    assert.equal(await page.locator("pre").filter({hasText: attempted}).count(), 0, "a failed Save never reports the attempted draft as saved");

    await page.evaluate(() => { window.__savedSolutionFailWrite = false; window.__savedSolutionFailRead = true; });
    await page.getByLabel(/Task:/).click();
    await openSavedSolution(page);
    await page.locator("[role='alert'], [role='status']").filter({hasText: /storage|read|unavailable|error/i}).waitFor();
    assert.deepEqual(diagnostics, {console: [], page: [], requests: [], responses: []}, "controlled storage failures are visible without browser diagnostics");
  } finally {
    await context.close();
    await browser.close();
  }
});
