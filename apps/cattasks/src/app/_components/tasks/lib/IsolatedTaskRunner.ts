import type {TaskTestCase} from "../catalog/taskCatalog";

const RUN_TIMEOUT_MS = 1_500;
const PARENT_GRACE_MS = 200;
const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export type IsolatedTaskRequest = { readonly requestId: string; readonly mode: "run" | "test"; readonly code: string; readonly entryPoint?: string; readonly tests?: readonly TaskTestCase[]; };
export type IsolatedTaskResult = { readonly requestId: string; readonly status: "completed" | "test-failed" | "runtime-error" | "timeout" | "cancelled"; readonly message: string; readonly logs: readonly string[]; readonly passedCount?: number; readonly totalTests?: number; };
type WorkerResult = IsolatedTaskResult & { readonly nonce: string };

function newToken(): string { return crypto.randomUUID(); }

function isWorkerResult(value: unknown, nonce: string, requestId: string): value is WorkerResult {
    if (!value || typeof value !== "object") return false;
    const result = value as Partial<WorkerResult>;
    return result.nonce === nonce && result.requestId === requestId &&
        (result.status === "completed" || result.status === "test-failed" || result.status === "runtime-error" || result.status === "timeout") &&
        typeof result.message === "string" && Array.isArray(result.logs) && result.logs.every(log => typeof log === "string");
}

function isReady(value: unknown, nonce: string, requestId: string): boolean {
    return Boolean(value && typeof value === "object" && (value as {type?: unknown}).type === "ready" && (value as {nonce?: unknown}).nonce === nonce && (value as {requestId?: unknown}).requestId === requestId);
}

function sandboxDocument(nonce: string, requestId: string): string {
    const workerSource = `
const MAX_LOGS = 40, MAX_LOG_LENGTH = 500;
self.onmessage = ({data}) => {
  const {nonce, requestId, mode, code, entryPoint, tests} = data || {}, logs = [];
  const postMessage = self.postMessage.bind(self), objectIs = Object.is, arrayIsArray = Array.isArray,
    numberIsNaN = Number.isNaN, objectKeys = Object.keys, hasOwn = Object.prototype.hasOwnProperty,
    reflectApply = Reflect.apply, arrayPush = Array.prototype.push, arrayMap = Array.prototype.map,
    arrayJoin = Array.prototype.join, string = String, stringSlice = String.prototype.slice,
    errorConstructor = Error;
  const text = value => { try { return reflectApply(stringSlice, string(value), [0, MAX_LOG_LENGTH]); } catch { return "[unprintable]"; } };
  const errorText = error => {
    try { return error && typeof error === "object" && typeof error.message === "string" ? error.message : string(error); }
    catch { return "Неизвестная ошибка"; }
  };
  const equal = (actual, expected) => {
    if (typeof actual !== typeof expected) return false;
    if (typeof actual === "number" && numberIsNaN(actual)) return false;
    if (actual === null || expected === null || typeof actual !== "object") return objectIs(actual, expected);
    if (arrayIsArray(actual) !== arrayIsArray(expected)) return false;
    if (arrayIsArray(actual)) {
      if (actual.length !== expected.length) return false;
      for (let index = 0; index < actual.length; index += 1) {
        if (!reflectApply(hasOwn, actual, [index]) || !reflectApply(hasOwn, expected, [index]) || !equal(actual[index], expected[index])) return false;
      }
      return true;
    }
    const actualKeys = objectKeys(actual), expectedKeys = objectKeys(expected);
    if (actualKeys.length !== expectedKeys.length) return false;
    for (let index = 0; index < expectedKeys.length; index += 1) {
      const key = expectedKeys[index];
      if (!reflectApply(hasOwn, actual, [key]) || !equal(actual[key], expected[key])) return false;
    }
    return true;
  };
  const report = (status, message, extra = {}) => postMessage({nonce, requestId, status, message, logs, ...extra});
  const capture = (...values) => {
    if (logs.length < MAX_LOGS) {
      const mapped = reflectApply(arrayMap, values, [text]);
      reflectApply(arrayPush, logs, [reflectApply(arrayJoin, mapped, [" "])]);
    }
  };
  try {
    self.console = {log: capture, info: capture, warn: capture, error: capture, debug: capture};
    if (mode === "run") { new Function('"use strict";\\n' + code)(); report("completed", logs.length ? reflectApply(arrayJoin, logs, ["\\n"]) : "Код выполнен"); return; }
    const entry = new Function('"use strict";\\n' + code + '\\nreturn typeof ' + entryPoint + ' === "function" ? ' + entryPoint + ' : undefined;')();
    if (typeof entry !== "function") throw new errorConstructor("Точка входа не найдена: " + entryPoint);
    let passedCount = 0;
    for (let index = 0; index < tests.length; index += 1) {
      const test = tests[index], actual = reflectApply(entry, undefined, test.args);
      if (actual && typeof actual.then === "function") throw new errorConstructor("Асинхронные решения не поддерживаются");
      if (!equal(actual, test.expected)) { report("test-failed", "Тест " + (index + 1) + ": проверка не пройдена\\nПройдено: " + passedCount + "/" + tests.length, {passedCount, totalTests: tests.length}); return; }
      passedCount += 1;
    }
    report("completed", "Все тесты пройдены: " + passedCount + "/" + tests.length, {passedCount, totalTests: tests.length});
  } catch (error) { report("runtime-error", "Ошибка выполнения: " + errorText(error)); }
};`;
    return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:"><script>
const expectedNonce = ${JSON.stringify(nonce)}, expectedRequestId = ${JSON.stringify(requestId)};
let worker, timer, started = false;
window.addEventListener('message', event => {
  const data = event.data;
  if (event.source !== parent || started || !data || typeof data !== 'object' || data.type !== 'start' ||
      data.nonce !== expectedNonce || data.requestId !== expectedRequestId || typeof data.code !== 'string' ||
      (data.mode !== 'run' && data.mode !== 'test') ||
      (data.mode === 'test' && (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(data.entryPoint) || !Array.isArray(data.tests)))) return;
  started = true;
  const blob = new Blob([${JSON.stringify(workerSource)}], {type: 'text/javascript'});
  const workerUrl = URL.createObjectURL(blob);
  const finish = result => { clearTimeout(timer); if (worker) worker.terminate(); URL.revokeObjectURL(workerUrl); parent.postMessage(result, '*'); };
  try { worker = new Worker(workerUrl); } catch (error) { finish({nonce: data.nonce, requestId: data.requestId, status: 'runtime-error', message: 'Ошибка выполнения: ' + error.message, logs: []}); return; }
  worker.onmessage = event => finish(event.data);
  worker.onerror = event => finish({nonce: data.nonce, requestId: data.requestId, status: 'runtime-error', message: 'Ошибка выполнения: ' + event.message, logs: []});
  timer = setTimeout(() => finish({nonce: data.nonce, requestId: data.requestId, status: 'timeout', message: 'Превышено время выполнения', logs: []}), ${RUN_TIMEOUT_MS});
  worker.postMessage(data);
});
parent.postMessage({type: 'ready', nonce: ${JSON.stringify(nonce)}, requestId: ${JSON.stringify(requestId)}}, '*');</script>`;
}

export function runIsolatedTask(request: IsolatedTaskRequest, signal?: AbortSignal): Promise<IsolatedTaskResult> {
    if (!request.code.trim()) return Promise.resolve({requestId: request.requestId, status: "runtime-error", message: "Код пустой", logs: []});
    if (request.mode === "test" && (!request.entryPoint || !identifierPattern.test(request.entryPoint) || !request.tests?.length)) return Promise.resolve({requestId: request.requestId, status: "runtime-error", message: "Некорректные данные задачи", logs: []});
    const nonce = newToken();
    const frame = document.createElement("iframe");
    frame.sandbox.add("allow-scripts");
    frame.hidden = true;
    frame.srcdoc = sandboxDocument(nonce, request.requestId);
    return new Promise(resolve => {
        let settled = false;
        const finish = (result: IsolatedTaskResult) => { if (settled) return; settled = true; clearTimeout(watchdog); signal?.removeEventListener("abort", cancel); window.removeEventListener("message", receive); frame.remove(); resolve(result); };
        const cancel = () => finish({requestId: request.requestId, status: "cancelled", message: "Запуск отменён", logs: []});
        const receive = (event: MessageEvent<unknown>) => {
            if (event.source !== frame.contentWindow) return;
            if (isReady(event.data, nonce, request.requestId)) { frame.contentWindow?.postMessage({type: "start", nonce, ...request}, "*"); return; }
            if (isWorkerResult(event.data, nonce, request.requestId)) { const {nonce: _nonce, ...result} = event.data; finish(result); }
        };
        const watchdog = window.setTimeout(() => finish({requestId: request.requestId, status: "timeout", message: "Превышено время выполнения", logs: []}), RUN_TIMEOUT_MS + PARENT_GRACE_MS);
        window.addEventListener("message", receive);
        document.body.append(frame);
        if (signal?.aborted) cancel(); else signal?.addEventListener("abort", cancel, {once: true});
    });
}
