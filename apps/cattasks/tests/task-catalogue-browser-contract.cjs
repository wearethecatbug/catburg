const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43814";
const catalog = {
  version: 1,
  tasks: [
    {id: "race", title: "Race", description: "First inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["race"], expected: "race"}]},
    {id: "digitize", title: "Digitize", description: "Second inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value + '!'; }", solution: "function echo(value) { return value + '!'; }", tests: [{args: ["digitize"], expected: "digitize!"}]},
  ],
};

async function setActiveDraft(page, previous, next) {
  await page.getByLabel("User JavaScript code").focus();
  const actual = await page.evaluate(({previous, next}) => {
    const model = (window.monaco?.editor.getModels() ?? []).find(candidate => candidate.getValue() === previous);
    if (!model) return null;
    model.setValue(next);
    return model.getValue();
  }, {previous, next});
  assert.equal(actual, next, "the focused visible Monaco model must receive the reviewed inert fixture");
}

async function assertVisibleDraft(page, expected, message) {
  await page.waitForFunction(expected => document.querySelector(".monaco-editor .view-lines")?.textContent?.replace(/\s/g, "") === expected.replace(/\s/g, ""), expected);
  const actual = (await page.locator(".monaco-editor .view-lines").innerText()).replace(/\s/g, "");
  assert.equal(actual, expected.replace(/\s/g, ""), message);
}

async function selectTask(page, title) {
  const selector = page.getByRole("combobox");
  await selector.fill(title);
  const option = page.getByRole("option", {name: new RegExp(title)});
  await option.waitFor({state: "visible"});
  await option.click();
  await page.waitForFunction(expected => document.querySelector("input[role='combobox']")?.value.includes(expected), title);
}

async function outputText(page, expected) {
  const outputPanel = page.getByRole("heading", {name: "Output"}).locator("..");
  const output = outputPanel.locator("pre");
  await output.waitFor({state: "visible"});
  await page.waitForFunction(({expected, heading}) => {
    const panel = Array.from(document.querySelectorAll("h2")).find(node => node.textContent?.trim() === heading)?.parentElement;
    return panel?.querySelector("pre")?.textContent?.trim() === expected;
  }, {expected, heading: "Output"});
  return (await output.textContent()).trim();
}

test("CatTasks reaches session Test/Run/failure/edit/switch/stale paths through the actual editor and Provider", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const failedResponses = [];
  await page.addInitScript(() => {
    window.__taskMessageProbe = {holdTerminal: false, heldTerminal: null, replayDispatches: 0, replayingTerminal: false};
    window.addEventListener("message", event => {
      const probe = window.__taskMessageProbe;
      const held = probe.heldTerminal;
      if (probe.replayingTerminal && held && event.data === held.data) probe.replayDispatches += 1;
      if (probe.holdTerminal && !held && event.source && event.data?.status === "completed") {
        probe.heldTerminal = {data: event.data, source: event.source, origin: event.origin};
        event.stopImmediatePropagation();
      }
    }, true);
  });
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => failedRequests.push({url: request.url(), error: request.failure()?.errorText ?? null}));
  page.on("response", response => { if (response.status() >= 400) failedResponses.push({url: response.url(), status: response.status()}); });
  await context.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    const editor = page.getByLabel("User JavaScript code");
    const testButton = page.getByRole("button", {name: "Test Code"});
    const runButton = page.getByRole("button", {name: "Run Code"});
    const infoButton = page.getByLabel(/Info: Показать информацию|Info: Показана информация/);
    await editor.waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
    await page.waitForFunction(() => document.querySelector("input[role='combobox']")?.value.includes("Race"));

    await infoButton.click();
    await setActiveDraft(page, catalog.tasks[0].starterCode, "function echo(value) { return value; }");
    await assertVisibleDraft(page, "function echo(value) { return value; }", "the visible editor shows the exact successful Test draft");
    await testButton.click();
    assert.equal(await outputText(page, "Все тесты пройдены: 1/1"), "Все тесты пройдены: 1/1");
    assert.match(await infoButton.getAttribute("aria-label"), /Показана информация/, "Test preserves the active content tab");
    assert.equal(await testButton.evaluate(node => node === document.activeElement), true, "Test leaves keyboard focus on its activating control");

    await runButton.click();
    assert.equal(await outputText(page, "Код выполнен"), "Код выполнен", "Run produces its own visible output");
    assert.match(await infoButton.getAttribute("aria-label"), /Показана информация/, "Run preserves the active tab");
    assert.equal(await runButton.evaluate(node => node === document.activeElement), true, "Run leaves focus on its activating control");

    await setActiveDraft(page, "function echo(value) { return value; }", "function echo() { return 'wrong'; }");
    await assertVisibleDraft(page, "function echo() { return 'wrong'; }", "the visible editor shows the exact failing Test draft");
    await testButton.click();
    assert.equal(await outputText(page, "Тест 1: проверка не пройдена\nПройдено: 0/1"), "Тест 1: проверка не пройдена\nПройдено: 0/1");
    assert.equal(await page.evaluate(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), "function echo() { return 'wrong'; }"), true, "the failed Test reports the draft currently visible in Monaco");

    await selectTask(page, "Digitize");
    const descriptionButton = page.getByLabel(/Task: Показано описание|Task: Показать описание/);
    assert.match(await descriptionButton.getAttribute("aria-label"), /Показано описание/, "switch uses the Provider's selected-task tab reset");
    const descriptionContent = page.locator("pre[aria-label='Описание задачи']");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Описание задачи");
    assert.equal(await descriptionContent.evaluate(node => node === document.activeElement), true, "task switch moves keyboard focus to the reset active tab content");
    await page.waitForFunction(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), catalog.tasks[1].starterCode);
    await assertVisibleDraft(page, catalog.tasks[1].starterCode, "the switched task renders its own starter draft");

    await selectTask(page, "Race");
    await setActiveDraft(page, "function echo() { return 'wrong'; }", "function echo(value) { return value; }");
    await page.evaluate(() => { window.__taskMessageProbe.holdTerminal = true; });
    await testButton.click();
    await page.waitForFunction(() => Boolean(window.__taskMessageProbe.heldTerminal), undefined, {timeout: 10_000});
    await selectTask(page, "Digitize");
    await setActiveDraft(page, catalog.tasks[1].starterCode, "function echo(value) { return `${value}!`; }");
    assert.equal(await outputText(page, "Run code or tests to see output."), "Run code or tests to see output.", "switching clears the stale task's visible output without changing the new draft");
    await assertVisibleDraft(page, "function echo(value) { return `${value}!`; }", "the switched task keeps its independently edited visible draft");
    const replay = await page.evaluate(() => {
      const probe = window.__taskMessageProbe;
      const held = probe.heldTerminal;
      probe.holdTerminal = false;
      probe.replayingTerminal = true;
      window.dispatchEvent(new MessageEvent("message", {data: held.data, source: held.source, origin: held.origin}));
      probe.replayingTerminal = false;
      return {heldStatus: held.data.status, dispatches: probe.replayDispatches};
    });
    assert.deepEqual(replay, {heldStatus: "completed", dispatches: 1}, "the genuine held terminal message is dispatched after the real edit and switch");
    assert.equal(await outputText(page, "Run code or tests to see output."), "Run code or tests to see output.", "the dispatched stale completion cannot overwrite the switched workspace output");

    await testButton.click();
    assert.equal(await outputText(page, "Все тесты пройдены: 1/1"), "Все тесты пройдены: 1/1", "the switched and edited task still completes through a fresh real Test");
    await selectTask(page, "Race");
    assert.equal(await outputText(page, "Run code or tests to see output."), "Run code or tests to see output.", "revisiting the original task proves the held response did not silently populate its workspace");

    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(failedResponses, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
