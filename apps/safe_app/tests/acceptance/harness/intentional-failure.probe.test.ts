import assert from "node:assert/strict";
import test from "node:test";

test("the selected failure probe reports a reached failing assertion", () => {
  assert.equal("intentional failing probe", "expected passing value");
});
