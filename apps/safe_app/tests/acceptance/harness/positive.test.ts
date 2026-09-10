import assert from "node:assert/strict";
import test from "node:test";

test("the selected harness executes a positive assertion", () => {
  assert.equal("harness assertion reached", "harness assertion reached");
});
