import assert from "node:assert/strict";
import test from "node:test";

import { createChallengeId } from "@/features/safe-game/model/challenge-id";

test("UUID challenge identities retain the caller-provided UUID value", () => {
  assert.equal(createChallengeId(() => 0.25, () => 1234, () => "uuid-1"), "uuid-1");
});

test("fallback challenge identities remain unique when random and time repeat", () => {
  const firstIdentity = createChallengeId(() => 0.25, () => 1234);
  const secondIdentity = createChallengeId(() => 0.25, () => 1234);

  assert.notEqual(firstIdentity, secondIdentity);
  assert.match(firstIdentity, /^hint-1234-/);
  assert.match(secondIdentity, /^hint-1234-/);
});
