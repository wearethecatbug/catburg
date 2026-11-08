import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const appRoot = resolve(__dirname, "..");
const appRequire = createRequire(resolve(appRoot, "package.json"));
const React = appRequire("react");
const { act } = React;
const renderer = appRequire("react-test-renderer");
const { renderToString } = appRequire("react-dom/server");
const typescript = appRequire("typescript");
const hookPath = resolve(appRoot, "src/shared/hooks/useLocalStorage.ts");

function loadActualHook() {
  const compiled = typescript.transpileModule(readFileSync(hookPath, "utf8"), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
    fileName: hookPath,
  }).outputText;
  const loaded = { exports: {} };
  vm.runInThisContext(`(function (exports, require, module, __filename, __dirname) {${compiled}\n})`, {
    filename: hookPath,
  })(loaded.exports, appRequire, loaded, hookPath, dirname(hookPath));
  return loaded.exports.useLocalStorage;
}

const useLocalStorage = loadActualHook();

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.reads = [];
    this.readError = null;
    this.writeError = null;
  }

  getItem(key) {
    this.reads.push(key);
    if (this.readError) throw this.readError;
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.writeError) throw this.writeError;
    this.values.set(key, String(value));
  }
}

async function withBrowser(options, run) {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const actDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  const originalError = console.error;
  const errors = [];
  const storage = new MemoryStorage(options?.storage);
  const fakeWindow = new EventTarget();
  Object.defineProperty(fakeWindow, "localStorage", { value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true });
  console.error = (...args) => {
    errors.push(args);
    originalError(...args);
  };
  const mounted = [];
  const browser = {
    errors,
    mount(name, key, initialValue, history) {
      let latest;
      function Probe({ storageKey, currentInitialValue, rerender }) {
        latest = useLocalStorage(storageKey, currentInitialValue);
        history.push({ value: latest[0], hydrated: latest[2], setter: latest[1], rerender });
        return null;
      }
      let root;
      act(() => {
        root = renderer.create(React.createElement(Probe, { storageKey: key, currentInitialValue: initialValue, rerender: 0 }));
      });
      const entry = {
        get latest() { return latest; },
        rerender(nextKey = key, nextInitialValue = initialValue, rerender = 1) {
          act(() => root.update(React.createElement(Probe, { storageKey: nextKey, currentInitialValue: nextInitialValue, rerender })));
        },
        unmount() {
          if (entry.unmounted) return;
          act(() => root.unmount());
          entry.unmounted = true;
        },
        unmounted: false,
      };
      mounted.push(entry);
      return entry;
    },
    storage,
    storageListenerCount() {
      return getEventListeners(fakeWindow, "storage").length;
    },
    storageEvent(key) {
      const event = new Event("storage");
      Object.defineProperty(event, "key", { value: key });
      fakeWindow.dispatchEvent(event);
    },
  };

  let result;
  let callbackError;
  let callbackFailed = false;
  let cleanupError;
  let cleanupFailed = false;
  try {
    result = await run(browser);
  } catch (error) {
    callbackFailed = true;
    callbackError = error;
  } finally {
    for (const entry of mounted.reverse()) {
      try {
        entry.unmount();
      } catch (error) {
        if (!cleanupFailed) {
          cleanupFailed = true;
          cleanupError = error;
        }
      }
    }
    console.error = originalError;
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    if (actDescriptor) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", actDescriptor);
    else delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
  if (callbackFailed && cleanupFailed) throw new AggregateError([callbackError, cleanupError], "withBrowser callback and cleanup failed");
  if (callbackFailed) throw callbackError;
  if (cleanupFailed) throw cleanupError;
  return result;
}

test("SSR observes only the supplied initial value", () => {
  const seen = [];
  function ServerProbe() {
    seen.push(useLocalStorage("ssr-key", "initial"));
    return null;
  }
  renderToString(React.createElement(ServerProbe));
  assert.equal(seen.length, 1);
  assert.deepEqual([seen[0][0], seen[0][2]], ["initial", false]);
});

test("hydrates, initializes missing storage, and keeps its setter stable for one key", async () => {
  await withBrowser({ storage: { restored: JSON.stringify("saved") } }, async ({ mount, storage, storageEvent }) => {
    const restoredHistory = [];
    const restored = mount("restored", "restored", "initial", restoredHistory);
    assert.equal(restoredHistory[0].value, "initial", "first client render must retain the initial value");
    assert.deepEqual([restored.latest[0], restored.latest[2]], ["saved", true]);
    const restoredSetter = restored.latest[1];
    restored.rerender("restored", "latest-initial", 3);
    assert.equal(restored.latest[0], "saved", "same-key initial-value changes must not reset restored state");
    assert.strictEqual(restored.latest[1], restoredSetter, "same-key initial-value changes must preserve setter identity");
    storage.values.set("restored", "not-json");
    act(() => storageEvent("restored"));
    assert.equal(restored.latest[0], "latest-initial", "invalid storage must recover to the latest same-key initial value");
    storage.readError = new Error("restored read unavailable");
    act(() => storageEvent("restored"));
    assert.equal(restored.latest[0], "latest-initial", "read failures must recover to the latest same-key initial value");
    storage.readError = null;

    const missingHistory = [];
    const missing = mount("missing", "missing", "fallback", missingHistory);
    assert.equal(missingHistory[0].value, "fallback");
    assert.equal(storage.getItem("missing"), JSON.stringify("fallback"));
    const stableSetter = missing.latest[1];

    missing.rerender();
    assert.strictEqual(missing.latest[1], stableSetter, "ordinary rerender must preserve setter identity");
    act(() => missing.latest[1]("direct"));
    assert.deepEqual([missing.latest[0], storage.getItem("missing")], ["direct", JSON.stringify("direct")]);
    assert.strictEqual(missing.latest[1], stableSetter, "direct write must preserve setter identity");
    act(() => missing.latest[1]((previous) => `${previous}!`));
    assert.deepEqual([missing.latest[0], storage.getItem("missing")], ["direct!", JSON.stringify("direct!")]);
    assert.strictEqual(missing.latest[1], stableSetter, "functional write must preserve setter identity");
    act(() => {
      missing.latest[1]((previous) => `${previous}-first`);
      missing.latest[1]((previous) => `${previous}-second`);
    });
    assert.deepEqual([missing.latest[0], storage.getItem("missing")], ["direct!-first-second", JSON.stringify("direct!-first-second")]);
    assert.strictEqual(missing.latest[1], stableSetter, "batched functional writes must preserve setter identity");

    storage.values.set("missing", JSON.stringify("event"));
    act(() => storageEvent("other-key"));
    assert.equal(missing.latest[0], "direct!-first-second", "other-key storage events must be ignored");
    act(() => storageEvent("missing"));
    assert.equal(missing.latest[0], "event");
    assert.strictEqual(missing.latest[1], stableSetter, "matching storage event must preserve setter identity");
    storage.values.set("missing", JSON.stringify("cleared"));
    act(() => storageEvent(null));
    assert.equal(missing.latest[0], "cleared", "null-key storage events must synchronize");
    assert.strictEqual(missing.latest[1], stableSetter, "null-key storage event must preserve setter identity");
  });
});

test("changes keys in one mounted component and changes setter identity only then", async () => {
  await withBrowser({ storage: { first: JSON.stringify("one"), second: JSON.stringify("two") } }, async ({ mount, storage, storageEvent }) => {
    const history = [];
    const probe = mount("probe", "first", "initial", history);
    const firstSetter = probe.latest[1];
    probe.rerender("second", "second-fallback", 2);
    assert.equal(probe.latest[0], "two");
    assert.notStrictEqual(probe.latest[1], firstSetter, "key transition is the allowed setter identity change");
    const secondSetter = probe.latest[1];
    storage.values.set("first", JSON.stringify("stale"));
    act(() => storageEvent("first"));
    assert.equal(probe.latest[0], "two", "old-key listener must be removed");
    storage.values.set("second", JSON.stringify("fresh"));
    act(() => storageEvent("second"));
    assert.equal(probe.latest[0], "fresh");
    assert.strictEqual(probe.latest[1], secondSetter);
    probe.rerender("third", "third-fallback", 3);
    assert.equal(probe.latest[0], "third-fallback", "key changes must initialize from their current initial value");
    assert.equal(storage.getItem("third"), JSON.stringify("third-fallback"));
  });
});

test("updates one same-document peer exactly once and excludes the writer", async () => {
  await withBrowser({ storage: { shared: JSON.stringify(0) } }, async ({ mount, storage, storageListenerCount }) => {
    const writerHistory = [];
    const peerHistory = [];
    const writer = mount("writer", "shared", 0, writerHistory);
    const peer = mount("peer", "shared", 0, peerHistory);
    const writerSetter = writer.latest[1];
    const peerSetter = peer.latest[1];
    assert.equal(storageListenerCount(), 2, "two live subscribers must install two storage listeners");
    const writerRenders = writerHistory.length;
    const peerRenders = peerHistory.length;
    storage.reads.length = 0;
    act(() => writer.latest[1]((value) => value + 1));
    assert.equal(writer.latest[0], 1);
    assert.equal(peer.latest[0], 1);
    assert.equal(writerHistory.length, writerRenders + 1, "writer must receive its own local update once");
    assert.equal(peerHistory.length, peerRenders + 1, "one peer must receive one same-document notification");
    assert.deepEqual(storage.reads, ["shared"], "same-document notification must read once for the peer and never reread the writer");
    assert.strictEqual(writer.latest[1], writerSetter);
    assert.strictEqual(peer.latest[1], peerSetter);
    act(() => writer.latest[1](0));
    act(() => {
      writer.latest[1]((value) => value + 1);
      peer.latest[1]((value) => value + 1);
    });
    assert.deepEqual([writer.latest[0], peer.latest[0], storage.getItem("shared")], [2, 2, JSON.stringify(2)]);
    assert.strictEqual(writer.latest[1], writerSetter);
    assert.strictEqual(peer.latest[1], peerSetter);
  });
});

test("retains in-memory recovery semantics for invalid JSON and storage failures", async () => {
  await withBrowser({ storage: { broken: "not-json" } }, async ({ mount, storage, errors }) => {
    const invalid = mount("invalid", "broken", "fallback", []);
    assert.deepEqual([invalid.latest[0], invalid.latest[2]], ["fallback", true]);
    assert.ok(errors.some((entry) => String(entry[0]).includes('Error reading localStorage key "broken"')));

    storage.readError = new Error("read unavailable");
    const readFailure = mount("read", "read-error", "initial", []);
    assert.deepEqual([readFailure.latest[0], readFailure.latest[2]], ["initial", true]);
    storage.readError = null;

    storage.writeError = new Error("write unavailable");
    const writeFailure = mount("write", "write-error", "initial", []);
    act(() => writeFailure.latest[1]("memory-only"));
    assert.equal(writeFailure.latest[0], "memory-only", "write failure must not discard the local state update");
    assert.equal(storage.getItem("write-error"), null, "failed initialization must not be reported as persisted");
    assert.ok(errors.some((entry) => String(entry[0]).includes('Error setting localStorage key "write-error"')));
  });
});

test("unmount removes listeners and stale same-document callbacks", async () => {
  await withBrowser({ storage: { cleanup: JSON.stringify("before") } }, async ({ mount, storage, storageEvent, storageListenerCount }) => {
    const writerHistory = [];
    const peerHistory = [];
    const writer = mount("writer", "cleanup", "initial", writerHistory);
    const peer = mount("peer", "cleanup", "initial", peerHistory);
    assert.equal(storageListenerCount(), 2, "two mounted hooks must be observed before cleanup");
    const peerRenders = peerHistory.length;
    peer.unmount();
    assert.equal(storageListenerCount(), 1, "peer unmount must remove exactly one storage listener");
    storage.reads.length = 0;
    act(() => writer.latest[1]("writer-only"));
    assert.deepEqual(storage.reads, [], "remaining writer must not notify or read through the removed peer");
    assert.equal(peerHistory.length, peerRenders, "removed peer must receive no same-document callback");
    storage.reads.length = 0;
    storage.values.set("cleanup", JSON.stringify("after"));
    act(() => storageEvent("cleanup"));
    assert.deepEqual(storage.reads, ["cleanup"], "only the remaining live listener may read after a storage event");
    const writerRenders = writerHistory.length;
    writer.unmount();
    assert.equal(storageListenerCount(), 0, "last unmount must remove the final storage listener");
    storage.reads.length = 0;
    act(() => storageEvent("cleanup"));
    assert.deepEqual(storage.reads, [], "no storage callback may survive the final unmount");
    assert.equal(writerHistory.length, writerRenders, "unmounted writer must not receive stale updates");
  });
});

test("withBrowser preserves callback and cleanup failures while restoring its environment", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const actDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  const originalError = console.error;

  const callbackOnly = new Error("callback only");
  let callbackOnlyListeners;
  await assert.rejects(withBrowser(null, async ({ mount, storageListenerCount }) => {
    mount("callback-only", "callback-only", 0, []);
    callbackOnlyListeners = storageListenerCount;
    throw callbackOnly;
  }), (error) => error === callbackOnly);
  assert.equal(callbackOnlyListeners(), 0);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "window"), windowDescriptor);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"), actDescriptor);
  assert.strictEqual(console.error, originalError);

  const cleanupOnly = new Error("cleanup only");
  let cleanupOnlyEntry;
  let cleanupOnlyListeners;
  await assert.rejects(withBrowser(null, async ({ mount, storageListenerCount }) => {
    cleanupOnlyEntry = mount("cleanup-only", "cleanup-only", 0, []);
    const unmount = cleanupOnlyEntry.unmount;
    cleanupOnlyEntry.unmount = () => {
      unmount();
      throw cleanupOnly;
    };
    cleanupOnlyListeners = storageListenerCount;
  }), (error) => error === cleanupOnly);
  assert.equal(cleanupOnlyEntry.unmounted, true);
  assert.equal(cleanupOnlyListeners(), 0);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "window"), windowDescriptor);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"), actDescriptor);
  assert.strictEqual(console.error, originalError);

  const callbackAndCleanup = new Error("callback and cleanup");
  const cleanupAndCallback = new Error("cleanup and callback");
  let bothEntry;
  let bothListeners;
  await assert.rejects(withBrowser(null, async ({ mount, storageListenerCount }) => {
    bothEntry = mount("both", "both", 0, []);
    const unmount = bothEntry.unmount;
    bothEntry.unmount = () => {
      unmount();
      throw cleanupAndCallback;
    };
    bothListeners = storageListenerCount;
    throw callbackAndCleanup;
  }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [callbackAndCleanup, cleanupAndCallback]);
    assert.strictEqual(error.errors[0], callbackAndCleanup);
    assert.strictEqual(error.errors[1], cleanupAndCallback);
    return true;
  });
  assert.equal(bothEntry.unmounted, true);
  assert.equal(bothListeners(), 0);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "window"), windowDescriptor);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"), actDescriptor);
  assert.strictEqual(console.error, originalError);
});
