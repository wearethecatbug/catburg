const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
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

test("runtime JSON record grading", async t => {
  const {deepEqual} = runnerAssertions;

  await t.test("accepts host, null-prototype, and foreign-realm plain JSON records", () => {
    assert.equal(deepEqual(
      {answer: [true, null, {zero: 0, text: "ok"}]},
      {answer: [true, null, {zero: 0, text: "ok"}]},
    ), true);

    const nullPrototypeRecord = Object.assign(Object.create(null), {answer: [0, false, {nested: "value"}]});
    assert.equal(deepEqual(nullPrototypeRecord, {answer: [0, false, {nested: "value"}]}), true);

    const foreignRecord = vm.runInNewContext("({answer: [true, 0, {nested: 'value'}]})");
    assert.equal(deepEqual(foreignRecord, {answer: [true, 0, {nested: "value"}]}), true);
  });

  await t.test("rejects non-JSON object instances in either comparison direction", () => {
    for (const [label, value] of [
      ["Date", new Date(0)],
      ["Map", new Map()],
      ["Set", new Set()],
      ["RegExp", /json/],
      ["boxed Number", new Number(0)],
    ]) {
      assert.equal(deepEqual(value, {}), false, `${label} must not equal a plain JSON record`);
      assert.equal(deepEqual({}, value), false, `a plain JSON record must not equal ${label}`);
    }
  });

  await t.test("rejects nested and foreign-realm Date surrogates", () => {
    assert.equal(deepEqual({value: new Date(0)}, {value: {}}), false, "a nested Date must not equal a nested plain JSON record");
    assert.equal(deepEqual({value: {}}, {value: new Date(0)}), false, "a nested plain JSON record must not equal a nested Date");

    const foreignDate = vm.runInNewContext("new Date(0)");
    assert.equal(deepEqual(foreignDate, {}), false, "a foreign-realm Date must not equal a plain JSON record");
    assert.equal(deepEqual({}, foreignDate), false, "a plain JSON record must not equal a foreign-realm Date");
  });
});
