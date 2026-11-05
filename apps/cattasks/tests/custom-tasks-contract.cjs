const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {loadTypeScript} = require("./helpers/load-typescript.cjs");

const appRoot = path.join(__dirname, "..", "src", "app", "_components", "tasks");
const catalog = loadTypeScript(path.join(appRoot, "catalog", "taskCatalog.ts"));
const transfer = loadTypeScript(path.join(appRoot, "customTasks", "customTaskTransfer.ts"));
const storageApi = loadTypeScript(path.join(appRoot, "customTasks", "customTaskStorage.ts"));

const builtInIds = new Set(["race", "digitize", "no-space"]);

function task(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    description: "An inert custom task fixture.",
    entryPoint: "echo",
    starterCode: "function echo(value) { return value; }",
    solution: "function echo(value) { return value; }",
    tests: [{args: [id], expected: id}],
    ...overrides,
  };
}

function document(tasks) {
  return JSON.stringify({version: 1, tasks});
}

class MemoryStorage {
  constructor(initial) {
    this.values = new Map(initial ? [[storageApi.CUSTOM_TASK_STORAGE_KEY, initial]] : []);
    this.writes = 0;
    this.readFailure = null;
    this.writeFailure = null;
  }

  getItem(key) {
    if (this.readFailure) throw this.readFailure;
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writes += 1;
    if (this.writeFailure) throw this.writeFailure;
    this.values.set(key, value);
  }

  raw() {
    return this.values.get(storageApi.CUSTOM_TASK_STORAGE_KEY) ?? null;
  }
}

function expectFailure(result, before, storage) {
  assert.equal(result.ok, false, "the rejected operation must return the public failure result");
  assert.match(result.message, /\S/, "a rejected operation must provide recoverable feedback");
  assert.equal(storage.raw(), before, "a rejected operation must preserve the raw persisted document");
}

test("custom records use the canonical definition validator and retain legacy omitted topics", () => {
  const legacy = task("legacy");
  assert.deepEqual(transfer.parseCustomTask(legacy), legacy);
  assert.deepEqual(catalog.parseTaskDefinition(legacy, "control"), legacy);
  assert.throws(() => transfer.parseCustomTask(task("bad-topic", {topic: "Geometry"})), /topic/i);
  assert.throws(() => transfer.parseCustomTask(task("null-topic", {topic: null})), /topic/i);
  assert.throws(() => transfer.parseCustomTask(task("bad-tests", {tests: []})), /tests/i);
  assert.throws(() => transfer.parseCustomTask(task("bad-json", {tests: [{args: [Infinity], expected: null}]})), /JSON|finite/i);
});

test("custom records reject every missing, blank, or wrong-typed required canonical field", () => {
  const invalidFields = [
    ["id", {id: "   "}],
    ["title", {title: "   "}],
    ["description", {description: "   "}],
    ["entry point", {entryPoint: "not-valid"}],
    ["starter code", {starterCode: "   "}],
    ["reference solution", {solution: "   "}],
    ["tests", {tests: []}],
    ["wrong field type", {title: 42}],
  ];
  for (const [label, overrides] of invalidFields) {
    assert.throws(() => transfer.parseCustomTask(task(`invalid-${label}`, overrides)), `${label} must reject before storage`);
  }
  assert.doesNotThrow(() => transfer.parseCustomTask(task("valid-control")), "the valid control distinguishes mandatory-field rejection");
});

test("export is custom-only and import accepts legacy and approved topics without changing escapes", () => {
  const legacy = task("legacy", {starterCode: "function echo(value) { return `\\${value}\\n`; }"});
  const tagged = task("tagged", {topic: "Arrays", description: "slashes \\\\ and quote \\\" stay exact"});
  const exported = transfer.exportCustomTasks([legacy, tagged]);
  assert.deepEqual(JSON.parse(exported), {version: 1, tasks: [legacy, tagged]});

  const result = transfer.preflightCustomTaskImport(exported, builtInIds, new Set());
  assert.equal(result.ok, true);
  assert.deepEqual(result.tasks, [legacy, tagged], "import returns only validated incoming records and preserves strings exactly");
});

test("import rejects every invalid whole document atomically against an existing custom collection", () => {
  const saved = task("saved", {topic: "Logic"});
  const storage = new MemoryStorage(document([saved]));
  const cases = [
    ["malformed JSON", "{"],
    ["wrong schema", JSON.stringify({version: 2, tasks: []})],
    ["unknown topic", document([task("unknown", {topic: "Geometry"})])],
    ["duplicate file IDs", document([task("twice"), task("twice")])],
    ["built-in collision", document([task("race")])],
    ["saved collision", document([task("saved")])],
  ];

  for (const [name, input] of cases) {
    const before = storage.raw();
    const result = transfer.preflightCustomTaskImport(input, builtInIds, new Set(["saved"]));
    assert.equal(result.ok, false, `${name} must reject before persistence`);
    assert.match(result.message, /\S/, `${name} must explain the recoverable rejection`);
    assert.equal(storage.raw(), before, `${name} cannot mutate saved state during preflight`);
  }
});

test("empty custom documents are valid no-ops", () => {
  const existing = task("existing", {topic: "Arrays"});
  const storage = new MemoryStorage(document([existing]));
  const imported = transfer.preflightCustomTaskImport(document([]), builtInIds, new Set([existing.id]));
  assert.deepEqual(imported, {ok: true, tasks: []});
  const before = storage.raw();
  const result = storageApi.appendCustomTasks(storage, imported.tasks, builtInIds);
  assert.deepEqual(result, {ok: true, tasks: [existing]});
  assert.equal(storage.raw(), before, "an empty valid document leaves existing custom state intact");
  assert.equal(storage.writes, 0, "an empty valid document performs no persistence write");
});

test("storage uses exactly the versioned custom key, reloads valid data, and appends with one commit", () => {
  assert.equal(storageApi.CUSTOM_TASK_STORAGE_KEY, "cattasks.custom-tasks.v1");
  const storage = new MemoryStorage();
  const missing = storageApi.loadCustomTasks(storage, builtInIds);
  assert.deepEqual(missing, {ok: true, tasks: []}, "a missing custom key is an empty valid collection");

  const legacy = task("legacy");
  const tagged = task("tagged", {topic: "Numbers"});
  const saved = storageApi.appendCustomTasks(storage, [legacy, tagged], builtInIds);
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.tasks, [legacy, tagged]);
  assert.equal(storage.writes, 1, "a fully preflighted append has one storage commit");
  assert.deepEqual(JSON.parse(storage.raw()), {version: 1, tasks: [legacy, tagged]});
  assert.deepEqual(storageApi.loadCustomTasks(storage, builtInIds), saved, "reload exposes the same saved custom records");
});

test("storage read, parse, schema, collision, and quota failures preserve the prior document and recover", () => {
  const saved = task("saved", {topic: "Strings"});
  const storage = new MemoryStorage(document([saved]));
  const control = task("control", {topic: "Logic"});

  for (const incoming of [[task("saved")], [task("race")], [task("twice"), task("twice")]]) {
    const before = storage.raw();
    const writes = storage.writes;
    expectFailure(storageApi.appendCustomTasks(storage, incoming, builtInIds), before, storage);
    assert.equal(storage.writes, writes, "invalid append input must fail before a storage commit");
  }

  for (const incoming of [
    [task("bad-topic", {topic: "Geometry"})],
    [task("bad-schema", {tests: []})],
  ]) {
    const before = storage.raw();
    const writes = storage.writes;
    expectFailure(storageApi.appendCustomTasks(storage, incoming, builtInIds), before, storage);
    assert.equal(storage.writes, writes, "invalid canonical input cannot partially append after a valid prefix");
  }

  const corrupt = new MemoryStorage("not json");
  const corruptBefore = corrupt.raw();
  expectFailure(storageApi.loadCustomTasks(corrupt, builtInIds), corruptBefore, corrupt);
  expectFailure(storageApi.appendCustomTasks(corrupt, [control], builtInIds), corruptBefore, corrupt);

  const schema = new MemoryStorage(JSON.stringify({version: 1, tasks: [task("invalid", {topic: "Geometry"})]}));
  const schemaBefore = schema.raw();
  expectFailure(storageApi.loadCustomTasks(schema, builtInIds), schemaBefore, schema);

  const unavailable = new MemoryStorage(document([saved]));
  unavailable.readFailure = new Error("storage unavailable");
  const unavailableBefore = unavailable.raw();
  expectFailure(storageApi.loadCustomTasks(unavailable, builtInIds), unavailableBefore, unavailable);
  expectFailure(storageApi.appendCustomTasks(unavailable, [control], builtInIds), unavailableBefore, unavailable);

  storage.writeFailure = new Error("quota exceeded");
  const beforeQuota = storage.raw();
  expectFailure(storageApi.appendCustomTasks(storage, [control], builtInIds), beforeQuota, storage);
  storage.writeFailure = null;
  const recovered = storageApi.appendCustomTasks(storage, [control], builtInIds);
  assert.equal(recovered.ok, true, "a later valid retry recovers without replacing existing records");
  assert.deepEqual(recovered.tasks, [saved, control]);
});

test("append reads latest storage before committing so stale callers cannot overwrite intervening custom tasks", () => {
  const first = task("first");
  const later = task("later", {topic: "Arrays"});
  const storage = new MemoryStorage(document([first]));
  const staleIncoming = [task("stale")];
  storage.values.set(storageApi.CUSTOM_TASK_STORAGE_KEY, document([first, later]));

  const result = storageApi.appendCustomTasks(storage, staleIncoming, builtInIds);
  assert.equal(result.ok, true);
  assert.deepEqual(result.tasks, [first, later, ...staleIncoming], "the final commit combines latest saved and incoming records append-only");
  assert.deepEqual(JSON.parse(storage.raw()).tasks, [first, later, ...staleIncoming]);
});
