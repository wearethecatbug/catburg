import assert from "node:assert/strict";
import test from "node:test";

test("SC01-005-A probe: the selected harness reports a reached failing assertion", () => {
  assert.equal("intentional failing probe", "expected passing value");
});
