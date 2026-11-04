const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {loadTypeScript} = require("./helpers/load-typescript.cjs");

const runnerAssertions = loadTypeScript(path.join(__dirname, "..", "src", "app", "_components", "tasks", "lib", "RunUserTests.ts"));

test("runner equality accepts equivalent JSON values but rejects values JSON.stringify would collapse", () => {
  const {assertExpectedEqualsActual, deepEqual} = runnerAssertions;

  assert.equal(deepEqual({answer: [true, null, {zero: 0, text: "ok"}]}, {answer: [true, null, {zero: 0, text: "ok"}]}), true);
  assert.equal(deepEqual(Number.NaN, null), false, "NaN must not pass as JSON null");
  assert.equal(deepEqual([undefined], [null]), false, "undefined array entries must not pass as null");
  assert.equal(deepEqual(new Array(1), [null]), false, "sparse array holes must not pass as JSON null entries");
  assert.equal(deepEqual({missing: undefined}, {}), false, "an own undefined field must not disappear during comparison");
  assert.equal(deepEqual({one: 1}, {one: "1"}), false, "test values must not be coerced");
  const failed = assertExpectedEqualsActual([undefined], [null], 1);
  assert.equal(failed.isPassed, false);
  assert.match(failed.message, /Тест 1/);
});
