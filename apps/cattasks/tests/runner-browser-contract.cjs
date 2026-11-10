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
  const result = page.getByRole("heading", {name: "Output"}).locator("..").locator("pre");
  await result.waitFor({state: "visible", timeout: 10_000});
  await page.waitForFunction(
    ({source, flags}) => {
      const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(node => node.textContent?.trim() === "Output");
      const node = heading?.parentElement?.querySelector("pre");
      return Boolean(node && new RegExp(source, flags).test(node.textContent?.trim() ?? ""));
    },
    {source: expectedTerminal.source, flags: expectedTerminal.flags},
    {timeout: 10_000},
  );
  return (await result.textContent()).trim();
}

async function withBlankRunnerPage(callback) {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const blankUrl = new URL("/__runner-oracle-blank", baseUrl).href;
  await context.route(blankUrl, route => route.fulfill({contentType: "text/html", body: "<!doctype html><title>runner oracle</title>"}));
  try {
    await page.goto(blankUrl, {waitUntil: "domcontentloaded"});
    const result = await callback(page);
    assert.deepEqual(pageErrors, [], "runner oracle blank page has no uncaught fixture errors");
    return result;
  } finally {
    await context.close();
    await browser.close();
  }
}

test("isolated worker JSON record grading", {timeout: 30_000}, async () => {
  await withBlankRunnerPage(async page => {
    const results = await page.evaluate(async ({runnerSource, catalogSource}) => {
      const catalogModule = {exports: {}};
      new Function("exports", "module", "require", catalogSource)(catalogModule.exports, catalogModule, request => { throw new Error(`unexpected catalog dependency: ${request}`); });
      const runnerModule = {exports: {}};
      new Function("exports", "module", "require", runnerSource)(runnerModule.exports, runnerModule, request => {
        if (request === "../catalog/taskCatalog") return catalogModule.exports;
        throw new Error(`unexpected runner dependency: ${request}`);
      });
      const run = runnerModule.exports.runIsolatedTask;
      const parsedNegativeZero = JSON.parse("-0");
      return {
        nested: await run({requestId: "worker-json-control", mode: "test", code: "function record() { return {answer: [true, {nested: [0, null]}]}; }", entryPoint: "record", tests: [{args: [], expected: {answer: [true, {nested: [0, null]}]}}]}),
        negativeZero: await run({requestId: "worker-negative-zero", mode: "test", code: "function value() { return {plain: 0 * -1, nested: [0 * -1]}; }", entryPoint: "value", tests: [{args: [], expected: {plain: 0, nested: [0]}}]}),
        positiveZero: await run({requestId: "worker-positive-zero", mode: "test", code: "function value() { return {plain: 0, nested: [0]}; }", entryPoint: "value", tests: [{args: [], expected: {plain: parsedNegativeZero, nested: [parsedNegativeZero]}}]}),
        date: await run({requestId: "worker-date-negative", mode: "test", code: "function record() { return new Date(0); }", entryPoint: "record", tests: [{args: [], expected: {}}]}),
        frames: document.querySelectorAll("iframe[sandbox]").length,
      };
    }, {runnerSource: runnerCommonJs, catalogSource: catalogCommonJs});
    assert.equal(results.nested.status, "completed", "actual isolated worker accepts a nested JSON record control");
    assert.equal(results.negativeZero.status, "completed", "actual isolated worker treats negative zero as JSON-number equal to zero");
    assert.equal(results.positiveZero.status, "completed", "actual isolated worker treats zero as JSON-number equal to parsed negative zero");
    assert.equal(results.date.status, "test-failed", "actual isolated worker must reject Date where the JSON expectation is a plain record");
    assert.equal(results.frames, 0, "each actual isolated worker run cleans up its opaque iframe");
  });
});

test("runner cleans up owned setup resources when sandbox append rejects", {timeout: 30_000}, async () => {
  await withBlankRunnerPage(async page => {
    const result = await page.evaluate(async ({runnerSource, catalogSource}) => {
      const catalogModule = {exports: {}};
      new Function("exports", "module", "require", catalogSource)(catalogModule.exports, catalogModule, request => { throw new Error(`unexpected catalog dependency: ${request}`); });
      const runnerModule = {exports: {}};
      new Function("exports", "module", "require", runnerSource)(runnerModule.exports, runnerModule, request => {
        if (request === "../catalog/taskCatalog") return catalogModule.exports;
        throw new Error(`unexpected runner dependency: ${request}`);
      });
      const run = runnerModule.exports.runIsolatedTask;
      const nativeAdd = window.addEventListener;
      const nativeRemove = window.removeEventListener;
      const nativeSetTimeout = window.setTimeout;
      const nativeClearTimeout = window.clearTimeout;
      const addDescriptor = Object.getOwnPropertyDescriptor(window, "addEventListener");
      const removeDescriptor = Object.getOwnPropertyDescriptor(window, "removeEventListener");
      const setTimeoutDescriptor = Object.getOwnPropertyDescriptor(window, "setTimeout");
      const clearTimeoutDescriptor = Object.getOwnPropertyDescriptor(window, "clearTimeout");
      const appendDescriptor = Object.getOwnPropertyDescriptor(HTMLBodyElement.prototype, "append");
      const nativeAppend = HTMLBodyElement.prototype.append;
      if (typeof nativeAppend !== "function") throw new Error("runner seam: native body append unavailable");
      let addedListener = null, loadTimer = null, appendFailures = 0, listenerRemovals = 0, timerClears = 0;
      let addInstalled = false, removeInstalled = false, setTimeoutInstalled = false, clearTimeoutInstalled = false, appendInstalled = false;
      let outcome = null, rejection = null;
      try {
        Object.defineProperty(window, "addEventListener", {
          configurable: true,
          writable: true,
          value(type, listener, options) {
            if (type === "message") {
              if (addedListener !== null) throw new Error("runner seam: more than one owned message listener");
              addedListener = listener;
            }
            return nativeAdd.call(window, type, listener, options);
          },
        });
        addInstalled = true;
        Object.defineProperty(window, "removeEventListener", {
          configurable: true,
          writable: true,
          value(type, listener, options) {
            if (type === "message" && listener === addedListener) {
              listenerRemovals += 1;
              if (listenerRemovals > 1) throw new Error("runner seam: duplicate owned message listener removal");
            }
            return nativeRemove.call(window, type, listener, options);
          },
        });
        removeInstalled = true;
        Object.defineProperty(window, "setTimeout", {
          configurable: true,
          writable: true,
          value(handler, delay, ...args) {
            const handle = nativeSetTimeout.call(window, handler, delay, ...args);
            if (Number(delay) === 5_000) {
              if (loadTimer !== null) throw new Error("runner seam: more than one owned load timer");
              loadTimer = handle;
            }
            return handle;
          },
        });
        setTimeoutInstalled = true;
        Object.defineProperty(window, "clearTimeout", {
          configurable: true,
          writable: true,
          value(handle) {
            if (handle === loadTimer) {
              timerClears += 1;
              if (timerClears > 1) throw new Error("runner seam: duplicate owned load timer clear");
            }
            return nativeClearTimeout.call(window, handle);
          },
        });
        clearTimeoutInstalled = true;
        Object.defineProperty(HTMLBodyElement.prototype, "append", {
          configurable: true,
          writable: true,
          value(...nodes) {
            const [node] = nodes;
            if (appendFailures === 0 && nodes.length === 1 && node instanceof HTMLIFrameElement && node.hidden && node.sandbox.contains("allow-scripts")) {
              appendFailures += 1;
              throw new Error("runner append probe");
            }
            return nativeAppend.apply(this, nodes);
          },
        });
        appendInstalled = true;
        outcome = await run({requestId: "append-cleanup", mode: "test", code: "function value() { return 1; }", entryPoint: "value", tests: [{args: [], expected: 1}]});
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "runner append probe") throw error;
        rejection = error.message;
      } finally {
        if (appendInstalled) { if (appendDescriptor) Object.defineProperty(HTMLBodyElement.prototype, "append", appendDescriptor); else delete HTMLBodyElement.prototype.append; }
        if (clearTimeoutInstalled) { if (clearTimeoutDescriptor) Object.defineProperty(window, "clearTimeout", clearTimeoutDescriptor); else delete window.clearTimeout; }
        if (setTimeoutInstalled) { if (setTimeoutDescriptor) Object.defineProperty(window, "setTimeout", setTimeoutDescriptor); else delete window.setTimeout; }
        if (removeInstalled) { if (removeDescriptor) Object.defineProperty(window, "removeEventListener", removeDescriptor); else delete window.removeEventListener; }
        if (addInstalled) { if (addDescriptor) Object.defineProperty(window, "addEventListener", addDescriptor); else delete window.addEventListener; }
      }
      return {outcome, rejection, appendFailures, listenerAdded: addedListener !== null, listenerRemovals, loadTimerAllocated: loadTimer !== null, timerClears, frames: document.querySelectorAll("iframe[sandbox]").length};
    }, {runnerSource: runnerCommonJs, catalogSource: catalogCommonJs});
    assert.equal(result.appendFailures, 1, "the exact owned sandbox iframe append fails once");
    assert.equal(result.listenerAdded, true, "the runner registers one owned parent message listener before append");
    assert.equal(result.listenerRemovals, 1, "the runner removes its exact owned message listener immediately after append failure");
    assert.equal(result.loadTimerAllocated, true, "the runner allocates its owned 5,000 ms load timer before append");
    assert.equal(result.timerClears, 1, "the runner clears its exact owned 5,000 ms load timer immediately after append failure");
    assert.equal(result.frames, 0, "the failed append leaves no sandbox frame");
    assert.equal(result.rejection, null, "the runner resolves its known setup failure rather than rejecting");
    assert.deepEqual(result.outcome, {requestId: "append-cleanup", status: "runtime-error", message: "Ошибка выполнения: runner append probe", logs: []}, "the runner resolves the injected setup failure as its existing terminal runtime result");
  });
});

test("runner phase boundaries", {timeout: 45_000}, async () => {
  await withBlankRunnerPage(async page => {
    const controls = await page.evaluate(async ({runnerSource, catalogSource}) => {
      const catalogModule = {exports: {}};
      new Function("exports", "module", "require", catalogSource)(catalogModule.exports, catalogModule, request => { throw new Error(`unexpected catalog dependency: ${request}`); });
      const runnerModule = {exports: {}};
      new Function("exports", "module", "require", runnerSource)(runnerModule.exports, runnerModule, request => {
        if (request === "../catalog/taskCatalog") return catalogModule.exports;
        throw new Error(`unexpected runner dependency: ${request}`);
      });
      const run = runnerModule.exports.runIsolatedTask;

      async function control(kind, abortBeforeReady) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "srcdoc");
        if (!descriptor?.get || !descriptor.set) throw new Error("runner seam: native srcdoc descriptor unavailable");
        const nativeSetTimeout = window.setTimeout.bind(window);
        const nativeClearTimeout = window.clearTimeout.bind(window);
        const trace = [], owned = [];
        let activeFrame = null, ownedWindowProxy = null, replacements = 0, started = 0, listenerCount = 0, duplicateInjected = false;
        const receive = event => {
          if (!event.isTrusted || event.source !== activeFrame?.contentWindow) return;
          owned.push(event.data);
          if (event.data?.type === "ready") {
            ownedWindowProxy = event.source;
            window.dispatchEvent(new MessageEvent("message", {data: {type: "execution-start", nonce: event.data.nonce, requestId: event.data.requestId}, source: window}));
            window.dispatchEvent(new MessageEvent("message", {data: {type: "execution-start", nonce: event.data.nonce, requestId: event.data.requestId}, source: ownedWindowProxy}));
            window.dispatchEvent(new MessageEvent("message", {data: {type: "execution-start", nonce: "wrong-nonce", requestId: event.data.requestId}, source: ownedWindowProxy}));
            window.dispatchEvent(new MessageEvent("message", {data: {type: "execution-start", nonce: event.data.nonce, requestId: "wrong-request"}, source: ownedWindowProxy}));
            window.dispatchEvent(new MessageEvent("message", {data: {type: "ready", nonce: event.data.nonce, requestId: event.data.requestId}, source: ownedWindowProxy}));
          }
          if (event.data?.type === "execution-start" && !duplicateInjected) {
            duplicateInjected = true;
            started += 1;
            window.dispatchEvent(new MessageEvent("message", {data: event.data, source: ownedWindowProxy}));
          }
        };
        const observer = new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLIFrameElement && node.sandbox.contains("allow-scripts")) activeFrame = node;
        });
        Object.defineProperty(HTMLIFrameElement.prototype, "srcdoc", {
          ...descriptor,
          set(value) {
            activeFrame = this;
            const source = String(value);
            const pattern = kind === "ready"
              ? /parent\.postMessage\(\{type: 'ready', nonce: [\s\S]*?\}, '\*'\);/
              : /worker\.postMessage\(data\);/;
            const transformed = source.replace(pattern, match => { replacements += 1; return `setTimeout(() => { ${match} }, 2500);`; });
            if (replacements !== 1 || transformed === source) throw new Error(`runner seam: expected one ${kind} anchor`);
            return descriptor.set.call(this, transformed);
          },
        });
        window.setTimeout = (handler, delay, ...args) => { trace.push({op: "set", delay: Number(delay)}); return nativeSetTimeout(handler, delay, ...args); };
        window.clearTimeout = handle => { trace.push({op: "clear"}); return nativeClearTimeout(handle); };
        window.addEventListener("message", receive); listenerCount += 1;
        observer.observe(document.body, {childList: true});
        let outcome;
        try {
          const controller = new AbortController();
          const resultPromise = run({requestId: `phase-${kind}-${abortBeforeReady ? "abort" : "complete"}`, mode: "test", code: "function record() { return {answer: [true, {nested: [0, null]}]}; }", entryPoint: "record", tests: [{args: [], expected: {answer: [true, {nested: [0, null]}]}}]}, controller.signal);
          if (abortBeforeReady) controller.abort();
          const result = await resultPromise;
          const traceBeforeLate = trace.length;
          if (ownedWindowProxy && owned[0]?.nonce && owned[0]?.requestId) window.dispatchEvent(new MessageEvent("message", {data: {type: "execution-start", nonce: owned[0].nonce, requestId: owned[0].requestId}, source: ownedWindowProxy}));
          outcome = {result, trace, traceBeforeLate, replacements, started, ownedTypes: owned.map(event => event?.type), frames: document.querySelectorAll("iframe[sandbox]").length};
        } finally {
          observer.disconnect();
          window.removeEventListener("message", receive); listenerCount -= 1;
          window.setTimeout = nativeSetTimeout;
          window.clearTimeout = nativeClearTimeout;
          Object.defineProperty(HTMLIFrameElement.prototype, "srcdoc", descriptor);
        }
        return {...outcome, listenerCountAfter: listenerCount};
      }

      return {ready: await control("ready", false), dispatch: await control("dispatch", false), abort: await control("ready", true)};
    }, {runnerSource: runnerCommonJs, catalogSource: catalogCommonJs});

    for (const [name, result] of Object.entries({ready: controls.ready, dispatch: controls.dispatch})) {
      assert.equal(result.replacements, 1, `${name} seam transforms exactly one generated anchor`);
      assert.equal(result.result.status, "completed", `${name} delayed valid startup retains the nested JSON control`);
      assert.deepEqual(result.trace.filter(entry => entry.op === "set").map(entry => entry.delay), [5_000, 1_700], `${name} starts one load timer then one execution/grace timer`);
      assert.equal(result.ownedTypes.filter(type => type === "execution-start").length, 1, `${name} observes exactly one real owned execution-start`);
      assert.equal(result.trace.length, result.traceBeforeLate, `${name} late duplicate cannot restart a settled trace`);
      assert.equal(result.frames, 0, `${name} leaves no sandbox frame`);
      assert.equal(result.listenerCountAfter, 0, `${name} fixture removes its parent listener after cleanup`);
    }
    assert.equal(controls.abort.replacements, 1, "abort seam transforms exactly one generated ready anchor");
    assert.equal(controls.abort.result.status, "cancelled", "pre-ready abort reaches the cancellation terminal state");
    assert.equal(controls.abort.started, 0, "pre-ready abort permits no owned execution-start");
    assert.deepEqual(controls.abort.ownedTypes, [], "pre-ready abort permits no owned ready or worker dispatch");
    assert.equal(controls.abort.frames, 0, "pre-ready abort removes the owned sandbox frame");
    assert.equal(controls.abort.trace.filter(entry => entry.op === "clear").length, 1, "pre-ready abort clears its only parent timer");
    assert.equal(controls.abort.listenerCountAfter, 0, "abort fixture removes its parent listener after cleanup");
  });
});

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
      const activeController = new AbortController();
      const activeRun = run({requestId: "abort-after-start", mode: "run", code: "while (true) {}"}, activeController.signal);
      await new Promise(resolve => setTimeout(resolve, 0));
      const framesBeforeAbort = document.querySelectorAll("iframe[sandbox]").length;
      activeController.abort();
      const cancelledAfterStart = await activeRun;
      return {typed, invalid, cancelled, framesBeforeAbort, cancelledAfterStart, frames: document.querySelectorAll("iframe[sandbox]").length};
    }, {runnerSource: runnerCommonJs, catalogSource: catalogCommonJs});
    assert.equal(directBoundary.typed.status, "completed");
    assert.deepEqual(directBoundary.invalid.map(result => result.status), ["test-failed", "test-failed", "test-failed", "test-failed", "test-failed", "test-failed"], "worker equality and terminal transport must reject wrong values even after submitted code replaces worker globals");
    assert.equal(directBoundary.cancelled.status, "cancelled");
    assert.equal(directBoundary.framesBeforeAbort, 1, "an in-flight runner owns one sandbox frame before cancellation");
    assert.equal(directBoundary.cancelledAfterStart.status, "cancelled", "aborting an already-started run reaches the cancellation terminal state");
    assert.equal(directBoundary.frames, 0);

    await replaceEditor(page, helperSolution);
    await page.evaluate(() => {
      const key = "__cattasksRunnerUuidProbe";
      if (key in window) throw new Error("runner seam: UUID probe already installed");
      const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
      const nativeRandomUUID = crypto.randomUUID.bind(crypto);
      let armed = true;
      Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value() {
          if (armed) {
            armed = false;
            throw new Error("runner nonce probe");
          }
          return nativeRandomUUID();
        },
      });
      window[key] = {descriptor};
    });
    let uuidProbeRestored = false;
    try {
      await testButton.click();
      const setupError = await readResult(page, /^Ошибка выполнения: runner nonce probe$/);
      assert.match(setupError, /^Ошибка выполнения: runner nonce probe$/, "the next runner UUID setup failure reaches a visible terminal Test result");
    } finally {
      await page.evaluate(() => {
        const key = "__cattasksRunnerUuidProbe";
        const state = window[key];
        if (!state) throw new Error("runner seam: UUID probe missing during restore");
        if (state.descriptor) Object.defineProperty(crypto, "randomUUID", state.descriptor);
        else delete crypto.randomUUID;
        delete window[key];
      });
      uuidProbeRestored = true;
    }
    assert.equal(uuidProbeRestored, true, "the one-shot UUID seam restores before recovery");
    await testButton.click();
    const passed = await readResult(page, /^Все тесты пройдены: 2\/2$/);
    assert.match(passed, /^Все тесты пройдены: 2\/2$/, "the helper-dependent task module must pass both typed catalog tests");

    await replaceEditor(page, "console.log('recovered-after-append');");
    await page.evaluate(() => {
      const key = "__cattasksRunnerAppendProbe";
      if (key in window) throw new Error("runner seam: append probe already installed");
      const descriptor = Object.getOwnPropertyDescriptor(HTMLBodyElement.prototype, "append");
      const nativeAppend = HTMLBodyElement.prototype.append;
      if (typeof nativeAppend !== "function") throw new Error("runner seam: native body append unavailable");
      let armed = true;
      Object.defineProperty(HTMLBodyElement.prototype, "append", {
        configurable: true,
        writable: true,
        value(...nodes) {
          const [node] = nodes;
          if (armed && nodes.length === 1 && node instanceof HTMLIFrameElement && node.hidden && node.sandbox.contains("allow-scripts")) {
            armed = false;
            throw new Error("runner append probe");
          }
          return nativeAppend.apply(this, nodes);
        },
      });
      window[key] = {descriptor};
    });
    let appendProbeRestored = false;
    try {
      await runButton.click();
      const appendError = await readResult(page, /^Ошибка выполнения: runner append probe$/);
      assert.match(appendError, /^Ошибка выполнения: runner append probe$/, "a rejected runner append reaches a visible terminal Run result");
      assert.equal(await page.locator("iframe[sandbox]").count(), 0, "a rejected public runner append leaves no sandbox frame");
    } finally {
      await page.evaluate(() => {
        const key = "__cattasksRunnerAppendProbe";
        const state = window[key];
        if (!state) throw new Error("runner seam: append probe missing during restore");
        if (state.descriptor) Object.defineProperty(HTMLBodyElement.prototype, "append", state.descriptor);
        else delete HTMLBodyElement.prototype.append;
        delete window[key];
      });
      appendProbeRestored = true;
    }
    assert.equal(appendProbeRestored, true, "the one-shot append seam restores before recovery");
    await runButton.click();
    const recoveredRun = await readResult(page, /^recovered-after-append$/);
    assert.match(recoveredRun, /^recovered-after-append$/, "Run Code recovers after append setup rejection");

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
