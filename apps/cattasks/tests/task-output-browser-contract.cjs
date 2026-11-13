const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Module = require("node:module");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const typescript = require("../node_modules/typescript");
const {selectTaskFromCatalogue} = require("./helpers/catalogue-selection.cjs");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:3002";
const catalog = {version: 1, tasks: [
  {id: "output-a", title: "Output A", description: "Trusted output fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["first"], expected: "first"}, {args: ["second"], expected: "second"}]},
  {id: "output-b", title: "Output B", description: "Independent output fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["other"], expected: "other"}]},
]};

async function replaceActiveDraft(page, expectedModelValue, value) {
  await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
  await page.waitForFunction(expectedModelValue => {
    const input = document.querySelector('textarea[aria-label="User JavaScript code"]');
    const editor = (window.monaco?.editor.getEditors() ?? []).find(candidate => {
      const node = candidate.getDomNode();
      return Boolean(input && node && node.contains(input));
    });
    const model = editor?.getModel();
    const rect = editor?.getDomNode()?.getBoundingClientRect();
    return Boolean(model && rect && rect.width > 0 && rect.height > 0 && model.getValue() === expectedModelValue);
  }, expectedModelValue, {timeout: 10_000});
  const actual = await page.evaluate(({expectedModelValue, value}) => {
    const input = document.querySelector('textarea[aria-label="User JavaScript code"]');
    const editor = (window.monaco?.editor.getEditors() ?? []).find(candidate => {
      const node = candidate.getDomNode();
      return Boolean(input && node && node.contains(input));
    });
    const model = editor?.getModel();
    const rect = editor?.getDomNode()?.getBoundingClientRect();
    if (!input || !editor || !model || !rect || rect.width <= 0 || rect.height <= 0) throw new Error("the visible user Monaco DOM, editor instance, and model are not ready");
    if (model.getValue() !== expectedModelValue) throw new Error("the visible user Monaco model has an unexpected value");
    model.setValue(value);
    return model.getValue();
  }, {expectedModelValue, value});
  assert.equal(actual, value, "the exact ready Monaco model receives the trusted fixture only");
}


async function textOccurrences(locator, text) {
  return locator.evaluate((node, text) => node.textContent.split(text).length - 1, text);
}

async function firstTextLineFitsScrollViewport(locator) {
  return locator.evaluate(node => {
    const viewport = node.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const line = [...range.getClientRects()].find(rect => rect.width > 0 && rect.height > 0);
    return line ? {
      lineTop: line.top,
      lineBottom: line.bottom,
      viewportTop: viewport.top,
      viewportBottom: viewport.bottom,
    } : null;
  });
}

function renderTaskOutputRecord(record) {
  const sourcePath = path.join(__dirname, "..", "src", "app", "_components", "tasks", "Browser TSX Components", "main", "TaskOutput.tsx");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cattasks-task-output-contract-"));
  const compiledPath = path.join(tempRoot, "TaskOutput.cjs");
  const cssLoader = Module._extensions[".css"];
  try {
    const compiled = typescript.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: {jsx: typescript.JsxEmit.ReactJSX, module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022},
      fileName: sourcePath,
    }).outputText;
    fs.writeFileSync(compiledPath, compiled);
    Module._extensions[".css"] = module => { module.exports = {__esModule: true, default: {}}; };
    const compiledModule = {exports: {}};
    new Function("exports", "require", "module", "__filename", "__dirname", compiled)(compiledModule.exports, Module.createRequire(sourcePath), compiledModule, compiledPath, path.dirname(sourcePath));
    const TaskOutput = compiledModule.exports.default;
    return ReactDOMServer.renderToStaticMarkup(React.createElement(TaskOutput, {taskId: "render-record", record}));
  } finally {
    if (cssLoader) Module._extensions[".css"] = cssLoader;
    else delete Module._extensions[".css"];
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

test("TaskOutput rejects invalid test counts while retaining actual terminal messages", {concurrency: false}, () => {
  const valid = renderTaskOutputRecord({mode: "test", result: {requestId: "valid", status: "test-failed", message: "first failure", logs: [], passedCount: 1, totalTests: 2}});
  assert.match(valid, /Passed: 1\/2/, "valid finite first-failure counts render as passed/declared only");

  for (const [label, passedCount, totalTests] of [["NaN", Number.NaN, 2], ["fraction", 1.5, 2], ["zero total", 0, 0], ["negative", -1, 2], ["passed exceeds total", 3, 2]]) {
    const message = `fallback-${label}`;
    const rendered = renderTaskOutputRecord({mode: "test", result: {requestId: label, status: "runtime-error", message, logs: [], passedCount, totalTests}});
    assert.doesNotMatch(rendered, /Passed:/, `${label} counts cannot be rendered as a plausible test summary`);
    assert.match(rendered, new RegExp(message), `${label} retains the real terminal message as the fallback`);
  }

  const timeout = renderTaskOutputRecord({mode: "test", result: {requestId: "timeout", status: "timeout", message: "Execution timed out.", logs: []}});
  const cancelled = renderTaskOutputRecord({mode: "run", result: {requestId: "cancelled", status: "cancelled", message: "Run cancelled.", logs: []}});
  assert.match(timeout, /Execution timed out\./, "timeout is distinguishable from pass without executing uncontrolled code");
  assert.match(cancelled, /Run cancelled\./, "cancelled is distinguishable from pass without executing uncontrolled code");
});

test("TaskOutput presents only the selected latest runner record through accessible Tests and Console views", {timeout: 20_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 768, height: 900}});
  const page = await context.newPage();
  const diagnostics = {console: [], page: [], request: [], response: [], catalogRequests: []};
  try {
    page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
    page.on("pageerror", error => diagnostics.page.push(error.message));
    page.on("requestfailed", request => diagnostics.request.push(`${request.method()} ${request.url()}`));
    page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
    await context.route("**/task-catalog.v1.json", route => {
      diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
      return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
    });
    assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"})).status(), 200);
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});

    const testsTab = page.getByRole("tab", {name: "Tests", exact: true});
    const consoleTab = page.getByRole("tab", {name: "Console", exact: true});
    const output = page.getByRole("region", {name: "Output"});
    const testButton = page.getByRole("button", {name: "Test Code", exact: true});
    const runButton = page.getByRole("button", {name: "Run Code", exact: true});
    await Promise.all([testsTab.waitFor(), consoleTab.waitFor(), output.waitFor()]);
    assert.equal(await testsTab.getAttribute("aria-selected"), "true", "Tests is the deterministic initial Output view");
    const tabWiring = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map(tab => {
      const panelId = tab.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      return {panelId, panelExists: Boolean(panel), tabIndex: tab.getAttribute("tabindex")};
    }));
    assert.deepEqual(tabWiring, [
      {panelId: tabWiring[0].panelId, panelExists: true, tabIndex: "0"},
      {panelId: tabWiring[1].panelId, panelExists: true, tabIndex: "-1"},
    ], "each tab controls a persistent panel and only the active tab is in the tab sequence");
    await testsTab.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await consoleTab.evaluate(node => node === document.activeElement), true, "right arrow moves tab focus to Console");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await testsTab.evaluate(node => node === document.activeElement), true, "left arrow returns tab focus to Tests");

    await replaceActiveDraft(page, "function echo(value) { return value; }", "function echo(value) { console.log(value); return value; }");
    await testButton.click();
    await page.getByText(/^Passed:\s*2\/2$/).waitFor();
    assert.match((await output.innerText()), /2\s*\/\s*2/, "a completed test shows the validated passed and declared count");
    assert.doesNotMatch(await output.innerText(), /failed:\s*0/i, "a completed test does not invent a derived failure count");
    await page.setViewportSize({width: 768, height: 768});
    const completedTestLine = await firstTextLineFitsScrollViewport(page.getByRole("tabpanel", {name: "Tests", exact: true}).locator("pre"));
    assert.ok(
      completedTestLine && completedTestLine.lineTop >= completedTestLine.viewportTop && completedTestLine.lineBottom <= completedTestLine.viewportBottom,
      "the first completed Test output line fits the Tests scroll viewport at 768x768",
    );

    await consoleTab.click();
    const consolePanel = page.getByRole("tabpanel", {name: "Console", exact: true});
    await consolePanel.waitFor();
    assert.equal(await textOccurrences(consolePanel, "first"), 1, "the first captured test log appears exactly once in Console");
    assert.equal(await textOccurrences(consolePanel, "second"), 1, "the second captured test log appears exactly once in Console");

    await testsTab.click();
    await replaceActiveDraft(page, "function echo(value) { console.log(value); return value; }", "function echo(value) { return value === 'first' ? value : 'wrong'; }");
    await testButton.click();
    const firstFailure = page.getByRole("tabpanel", {name: "Tests", exact: true}).getByText("Test 2 failed.", {exact: true});
    await firstFailure.waitFor();
    assert.match(await output.innerText(), /Stopped at the first failing test/, "first failure has an explicit truthful stop status");
    assert.equal(await textOccurrences(output, "Passed: 1/2"), 1, "first-failure output renders the structured passed count exactly once");
    assert.doesNotMatch(await output.innerText(), /Test 2 failed\.\s*(?:\n|\s)*Passed:/, "failure text does not duplicate the structured passed count");
    assert.doesNotMatch(await output.innerText(), /2\s*\/\s*2/, "first-failure output cannot claim later tests passed");

    await replaceActiveDraft(page, "function echo(value) { return value === 'first' ? value : 'wrong'; }", "console.log('trusted-run-log'); return 42;");
    await runButton.click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "tab" && document.activeElement?.textContent === "Console" || document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === "Console", undefined, {timeout: 10_000});
    await consoleTab.click();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="tabpanel"] pre')].some(node => node.textContent?.includes("trusted-run-log")));
    assert.equal(await textOccurrences(consolePanel, "trusted-run-log"), 1, "Run log is not duplicated between terminal message and Console");
    assert.match(await consolePanel.innerText(), /42/, "Run return terminal information remains visible in Console");

    await replaceActiveDraft(page, "console.log('trusted-run-log'); return 42;", "throw new Error('trusted-runtime-error');");
    await runButton.click({timeout: 10_000});
    const visibleConsole = page.getByRole("tabpanel", {name: "Console", exact: true});
    await visibleConsole.getByText(/Runtime error: trusted-runtime-error/).waitFor({timeout: 10_000});
    assert.match(await visibleConsole.innerText(), /Runtime error/, "runtime error has an explicit status distinct from failed tests");
    assert.match(await output.innerText(), /Runtime error: trusted-runtime-error/, "runtime error is distinguished from a failed test");

    await selectTaskFromCatalogue(page, "Output B");
    assert.doesNotMatch(await output.innerText(), /trusted-runtime-error|trusted-run-log|1\s*\/\s*2/, "selecting another task cannot show a stale prior task result");

    assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: [], catalogRequests: [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]}, "trusted fixture uses one routed catalog request and has no diagnostics");
  } finally {
    await context.close();
    await browser.close();
  }
});
