const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {loadTypeScript} = require("./helpers/load-typescript.cjs");

const appRoot = path.join(__dirname, "..", "src", "app", "_components", "tasks");
const catalog = loadTypeScript(path.join(appRoot, "catalog", "taskCatalog.ts"));
const transfer = loadTypeScript(path.join(appRoot, "customTasks", "customTaskTransfer.ts"));
const builtInIds = new Set(["race", "digitize", "no-space"]);

function task(id = "valid-task", overrides = {}) {
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
    assert.throws(() => transfer.parseCustomTask(task("valid-control", overrides)), `${label} must reject before storage`);
  }
  for (const field of ["id", "title", "description", "entryPoint", "starterCode", "solution", "tests"]) {
    const missing = task("valid-control");
    delete missing[field];
    assert.throws(() => transfer.parseCustomTask(missing), `${field} must reject when omitted`);
  }
  assert.doesNotThrow(() => transfer.parseCustomTask(task("valid-control")), "the valid control distinguishes canonical rejection");
});

test("export is custom-only and import accepts legacy and approved topics without changing escapes", () => {
  const legacy = task("legacy", {starterCode: "function echo(value) { return `\\${value}\\n`; }"});
  const tagged = task("tagged", {topic: "Arrays", description: "slashes \\\\ and quote \\\" stay exact"});
  const exported = transfer.exportCustomTasks([legacy, tagged]);
  assert.deepEqual(JSON.parse(exported), {version: 1, tasks: [legacy, tagged]});
  assert.deepEqual(transfer.preflightCustomTaskImport(exported, builtInIds, new Set()), {ok: true, tasks: [legacy, tagged]});
});

test("preflight rejects complete invalid documents without yielding an appendable prefix", () => {
  const savedIds = new Set(["saved"]);
  const cases = [
    ["malformed JSON", "{"],
    ["wrong schema", JSON.stringify({version: 2, tasks: []})],
    ["unknown topic", document([task("unknown", {topic: "Geometry"})])],
    ["duplicate file IDs", document([task("twice"), task("twice")])],
    ["built-in collision", document([task("race")])],
    ["saved collision", document([task("saved")])],
    ["valid prefix then invalid topic", document([task("valid-prefix"), task("invalid-suffix", {topic: "Geometry"})])],
    ["valid prefix then built-in collision", document([task("valid-prefix-two"), task("race")])],
  ];
  for (const [label, input] of cases) {
    const result = transfer.preflightCustomTaskImport(input, builtInIds, savedIds);
    assert.equal(result.ok, false, `${label} must reject before a repository transaction starts`);
    assert.match(result.message, /\S/, `${label} must explain recoverable rejection`);
  }
  assert.deepEqual(transfer.preflightCustomTaskImport(document([]), builtInIds, savedIds), {ok: true, tasks: []}, "an empty document is a valid no-op input");
});
