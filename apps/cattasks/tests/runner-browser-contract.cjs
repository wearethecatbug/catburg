const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const typescript = require("../node_modules/typescript");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43814";
const networkProbeUrl = "https://runner-network-probe.invalid/blocked";
const runnerSource = fs.readFileSync(path.join(__dirname, "..", "src", "app", "_components", "tasks", "lib", "IsolatedTaskRunner.ts"), "utf8");
const catalogSource = fs.readFileSync(path.join(__dirname, "..", "src", "app", "_components", "tasks", "catalog", "taskCatalog.ts"), "utf8");
const runnerCommonJs = typescript.transpileModule(runnerSource, {compilerOptions: {module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022}}).outputText;
const catalogCommonJs = typescript.transpileModule(catalogSource, {compilerOptions: {module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022}}).outputText;
const helperSolution = `function catchUpSeconds(lead, speedGap) {
  return Math.floor((lead / speedGap) * 3600);
}
function race(v1, v2, g) {
  if (v1 >= v2) return null;
  const seconds = catchUpSeconds(g, v2 - v1);
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
}`;
const catalog = {version: 1, tasks: [{
  id: "race", title: "Race", description: "Inert runner fixture.", entryPoint: "race", starterCode: helperSolution, solution: helperSolution,
  tests: [{args: [720, 850, 70], expected: [0, 32, 18]}, {args: [80, 91, 37], expected: [3, 21, 49]}],
}]};

async function replaceEditor(page, code) {
  await page.getByLabel("User JavaScript code").waitFor({state: "visible", timeout: 10_000});
  const actual = await page.evaluate(expected => {
    const monaco = window.monaco;
    const model = monaco?.editor.getModels().find(candidate => candidate.uri.path === "/solution-race.js");
    if (!model) throw new Error("race editor model is unavailable");
    model.setValue(expected);
    return model.getValue();
  }, code);
  assert.equal(actual, code, "the race Monaco model must contain the exact submitted program before public control execution");
}

async function readResult(page, expectedTerminal) {
  const result = page.getByRole("tabpanel").locator("pre");
  await result.waitFor({state: "visible", timeout: 10_000});
  await page.waitForFunction(
    ({source, flags}) => {
      const node = document.querySelector('[role="tabpanel"]:not([hidden]) pre');
      return Boolean(node && new RegExp(source, flags).test(node.textContent?.trim() ?? ""));
    },
    {source: expectedTerminal.source, flags: expectedTerminal.flags},
    {timeout: 10_000},
  );
  return (await result.textContent()).trim();
}

test("CatTasks executes Test and Run through a browser-isolated runner with terminal outcomes and recovery", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const probeRequests = [];
  const probeFailures = [];
  const probeResponses = [];
  const catalogRequests = [];
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    consoleErrors.push(text);
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    if (request.url() === networkProbeUrl) probeRequests.push(request.url());
  });
  page.on("requestfailed", request => { if (request.url() === networkProbeUrl) probeFailures.push(request.failure()); });
  page.on("response", response => { if (response.url() === networkProbeUrl) probeResponses.push(response.status()); });
  await context.route("**/task-catalog.v1.json", route => {
    catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    const testButton = page.getByRole("button", {name: "Test Code"});
    const runButton = page.getByRole("button", {name: "Run Code"});
    await assert.doesNotReject(testButton.waitFor({state: "visible", timeout: 10_000}));
    await assert.doesNotReject(runButton.waitFor({state: "visible", timeout: 10_000}));
    await page.getByLabel("User JavaScript code").waitFor({state: "visible", timeout: 10_000});
    await page.waitForTimeout(1_500);
    assert.deepEqual(catalogRequests, [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`], "the runner scenario receives one inert canonical catalogue GET");

    const directBoundary = await page.evaluate(async ({runnerSource, catalogSource}) => {
      const catalogModule = {exports: {}};
      new Function("exports", "module", "require", catalogSource)(catalogModule.exports, catalogModule, request => {
        throw new Error(`unexpected catalog dependency: ${request}`);
      });
      const runnerModule = {exports: {}};
      new Function("exports", "module", "require", runnerSource)(runnerModule.exports, runnerModule, request => {
        if (request === "../catalog/taskCatalog") return catalogModule.exports;
        throw new Error(`unexpected runner dependency: ${request}`);
      });
      const {runIsolatedTask} = runnerModule.exports;
      const run = (request, signal) => runIsolatedTask(request, signal);
      const typed = await run({requestId: "typed-contract", mode: "test", code: "function echo(...values) { return values; }", entryPoint: "echo", tests: [{args: [], expected: []}, {args: [true, {nested: [0, false]}, "line\\n\\\"quote\\\"", null, 0], expected: [true, {nested: [0, false]}, "line\\n\\\"quote\\\"", null, 0]}]});
      const invalid = await Promise.all([
        run({requestId: "nan", mode: "test", code: "function value() { return NaN; }", entryPoint: "value", tests: [{args: [], expected: null}]}),
        run({requestId: "sparse", mode: "test", code: "function value() { return new Array(1); }", entryPoint: "value", tests: [{args: [], expected: [null]}]}),
        run({requestId: "undefined-field", mode: "test", code: "function value() { return {a: undefined}; }", entryPoint: "value", tests: [{args: [], expected: {}}]}),
        run({requestId: "coercion", mode: "test", code: "function value() { return 1; }", entryPoint: "value", tests: [{args: [], expected: "1"}]}),
        run({requestId: "mutated-object-is", mode: "test", code: "Object.is = () => true; function value() { return 1; }", entryPoint: "value", tests: [{args: [], expected: 2}]}),
        run({requestId: "mutated-post-message", mode: "test", code: "const report = self.postMessage; self.postMessage = result => report({...result, status: 'completed'}); function value() { return 1; }", entryPoint: "value", tests: [{args: [], expected: 2}]}),
      ]);
      const controller = new AbortController(); controller.abort();
      const cancelled = await run({requestId: "pre-aborted", mode: "run", code: "console.log('must-not-run')"}, controller.signal);
      return {typed, invalid, cancelled, frames: document.querySelectorAll("iframe[sandbox]").length};
    }, {runnerSource: runnerCommonJs, catalogSource: catalogCommonJs});
    assert.equal(directBoundary.typed.status, "completed");
    assert.deepEqual(directBoundary.invalid.map(result => result.status), ["test-failed", "test-failed", "test-failed", "test-failed", "test-failed", "test-failed"], "worker equality and terminal transport must reject wrong values even after submitted code replaces worker globals");
    assert.equal(directBoundary.cancelled.status, "cancelled");
    assert.equal(directBoundary.frames, 0);

    await replaceEditor(page, helperSolution);
    await testButton.click();
    const passed = await readResult(page, /^Все тесты пройдены: 2\/2$/);
    assert.match(passed, /^Все тесты пройдены: 2\/2$/, "the helper-dependent task module must pass both typed catalog tests");

    await replaceEditor(page, "function race() { return null; }");
    await testButton.click();
    const failed = await readResult(page, /^Тест 1: проверка не пройдена\nПройдено: 0\/2$/);
    assert.match(failed, /^Тест 1: проверка не пройдена\nПройдено: 0\/2$/, "a wrong return value must report the failed test and count");

    await replaceEditor(page, "function race() { throw new Error('runner failure'); }");
    await testButton.click();
    const runtimeError = await readResult(page, /^Ошибка выполнения: runner failure$/);
    assert.match(runtimeError, /^Ошибка выполнения: runner failure$/, "a thrown user error must report runtime failure rather than a failed assertion");

    await page.evaluate(() => { globalThis.__runnerParentConsole = console.log; });
    await replaceEditor(page, "globalThis.__runnerLeakProbe = 'worker-only'; console.log('runner-safe-log');");
    await runButton.click();
    const runOutput = await readResult(page, /runner-safe-log/);
    assert.match(runOutput, /runner-safe-log/, "Run Code must expose its isolated console output distinctly");
    assert.equal(await page.evaluate(() => globalThis.__runnerLeakProbe), undefined, "submitted code must not mutate the application global");
    assert.equal(await page.evaluate(() => console.log === globalThis.__runnerParentConsole), true, "submitted code must not replace the parent console");

    await replaceEditor(page, "return 42;");
    await runButton.click();
    const returnedValue = await readResult(page, /42/);
    assert.match(returnedValue, /42/, "Run Code must expose a non-undefined isolated return value when there are no logs");

    await replaceEditor(page, `try { const request = new XMLHttpRequest(); request.open("GET", ${JSON.stringify(networkProbeUrl)}, false); request.send(); console.log("network-unexpected"); } catch (error) { console.log("network-denied", error.name); }`);
    await runButton.click();
    const networkResult = await readResult(page, /^network-denied NetworkError$/);
    assert.match(networkResult, /^network-denied NetworkError$/, "the worker must observe a denied network request rather than a missing API");
    await page.waitForTimeout(250);
    assert.deepEqual(probeResponses, [], "the untrusted worker must not receive a network response");
    assert.deepEqual(probeRequests, [networkProbeUrl], "the uniquely identified worker attempt must be observed for this CSP scenario");
    assert.equal(probeFailures.length, 1, "the uniquely identified worker attempt must fail exactly once");
    assert.ok(["csp", "net::ERR_BLOCKED_BY_CSP"].includes(probeFailures[0]?.errorText), "the uniquely identified worker attempt must fail specifically at the CSP boundary, not DNS or a generic transport error");

    await replaceEditor(page, "while (true) {}");
    await runButton.click();
    await page.evaluate(() => window.postMessage({requestId: "forged", status: "completed", message: "forged", logs: []}, "*"));
    const frame = page.locator("iframe[sandbox]");
    await frame.waitFor({state: "attached", timeout: 5_000});
    const sandbox = await frame.evaluate(element => ({allowScripts: element.sandbox.contains("allow-scripts"), allowSameOrigin: element.sandbox.contains("allow-same-origin"), opaqueDocument: element.contentDocument === null}));
    assert.deepEqual(sandbox, {allowScripts: true, allowSameOrigin: false, opaqueDocument: true}, "the active worker host must be an opaque scripts-only iframe");
    await frame.evaluate(element => element.contentWindow?.postMessage({type: "start", nonce: "wrong-nonce", requestId: "wrong-request", mode: "run", code: "throw new Error('forged')"}, "*"));
    const timeout = await readResult(page, /^Превышено время выполнения$/);
    assert.match(timeout, /^Превышено время выполнения$/, "a non-terminating program must report the timeout terminal state");
    assert.notEqual(timeout, "forged", "a malformed message from the wrong source must not replace the active result");

    await replaceEditor(page, "console.log('fresh-after-timeout');");
    await runButton.click();
    const recovered = await readResult(page, /fresh-after-timeout/);
    assert.match(recovered, /fresh-after-timeout/, "a fresh valid run must succeed after timeout cleanup");

    await replaceEditor(page, "while (true) {}");
    await testButton.click();
    await replaceEditor(page, helperSolution);
    await testButton.click();
    const afterEdit = await readResult(page, /^Все тесты пройдены: 2\/2$/);
    assert.match(afterEdit, /^Все тесты пройдены: 2\/2$/, "an old result must not overwrite the newer edited program result");

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks isolates Product Except Self grading across published zero cases", {timeout: 30_000}, async () => {
  const publishedCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "task-catalog.v1.json"), "utf8"));
  const task = publishedCatalog.tasks.find(candidate => candidate.id === "ct-js-32");
  assert.ok(task, "the published Product Except Self task must be available");
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const httpFailures = [];
  const catalogRequests = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => requestFailures.push({url: request.url(), error: request.failure()?.errorText ?? null}));
  page.on("response", response => { if (response.status() >= 400) httpFailures.push({url: response.url(), status: response.status()}); });
  page.on("request", request => { if (new URL(request.url()).pathname === "/task-catalog.v1.json") catalogRequests.push(request.method()); });

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200, "the public application route responds");
    await page.getByLabel("User JavaScript code").waitFor({state: "visible", timeout: 10_000});
    const results = await page.evaluate(async ({runnerSource, catalogSource, task}) => {
      const catalogModule = {exports: {}};
      new Function("exports", "module", "require", catalogSource)(catalogModule.exports, catalogModule, request => {
        throw new Error(`unexpected catalog dependency: ${request}`);
      });
      const runnerModule = {exports: {}};
      new Function("exports", "module", "require", runnerSource)(runnerModule.exports, runnerModule, request => {
        if (request === "../catalog/taskCatalog") return catalogModule.exports;
        throw new Error(`unexpected runner dependency: ${request}`);
      });
      const {runIsolatedTask} = runnerModule.exports;
      const run = (requestId, code) => runIsolatedTask({requestId, mode: "test", code, entryPoint: task.entryPoint, tests: task.tests});
      const correct = await run("product-correct", "function productExceptSelf(numbers) { return numbers.map((_, index) => numbers.reduce((product, number, otherIndex) => otherIndex === index ? product : product * number, 1)); }");
      const divisionOnly = await run("product-division", "function productExceptSelf(numbers) { const total = numbers.reduce((product, number) => product * number, 1); return numbers.map(number => total / number); }");
      const singleZeroOnly = await run("product-single-zero", "function productExceptSelf(numbers) { const zeroCount = numbers.filter(number => number === 0).length; const total = numbers.reduce((product, number) => product * number, 1); const nonZeroProduct = numbers.reduce((product, number) => number === 0 ? product : product * number, 1); return numbers.map(number => zeroCount === 0 ? total / number : number === 0 ? nonZeroProduct : 0); }");
      return {correct, divisionOnly, singleZeroOnly, frames: document.querySelectorAll("iframe[sandbox]").length};
    }, {runnerSource: runnerCommonJs, catalogSource: catalogCommonJs, task});

    assert.equal(task.tests.length, 5, "the published task supplies all five grading cases");
    assert.deepEqual(results.correct, {requestId: "product-correct", status: "completed", message: "Все тесты пройдены: 5/5", logs: [], passedCount: 5, totalTests: 5}, "a correct array implementation passes every published Product Except Self case");
    assert.deepEqual(results.divisionOnly, {requestId: "product-division", status: "test-failed", message: "Тест 4: проверка не пройдена\nПройдено: 3/5", logs: [], passedCount: 3, totalTests: 5}, "the first zero case rejects division-only code");
    assert.deepEqual(results.singleZeroOnly, {requestId: "product-single-zero", status: "test-failed", message: "Тест 5: проверка не пройдена\nПройдено: 4/5", logs: [], passedCount: 4, totalTests: 5}, "the multiple-zero case rejects code that only handles one zero");
    assert.equal(results.frames, 0, "each direct isolated runner attempt removes its sandbox frame");
    assert.deepEqual(catalogRequests, ["GET"], "the public page performs one catalogue request before the direct runner checks");
    assert.deepEqual({consoleErrors, pageErrors, requestFailures, httpFailures}, {consoleErrors: [], pageErrors: [], requestFailures: [], httpFailures: []}, "the published runner regression has clean browser diagnostics");
  } finally {
    await context.close();
    await browser.close();
  }
});
