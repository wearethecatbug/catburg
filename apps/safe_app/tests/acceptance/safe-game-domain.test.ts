import assert from "node:assert/strict";
import test from "node:test";

import {
  createSafeGameState,
  generateSafeCode,
  normalizeSafeGuess,
  reduceSafeGame,
} from "@/features/safe-game/domain";

type SafeGameAction = Parameters<typeof reduceSafeGame>[1];

function apply(
  state: ReturnType<typeof createSafeGameState>,
  ...actions: SafeGameAction[]
) {
  return actions.reduce(reduceSafeGame, state);
}

function roundIdOf(state: object) {
  return (state as Record<string, unknown>).roundId;
}

test("the domain action contract excludes presentation-only action names", () => {
  const retained: SafeGameAction = { type: "set-input", input: "7" };
  assert.equal(retained.type, "set-input");

  // @ts-expect-error presentation hover belongs to the presentation machine
  const removedHover: SafeGameAction = { type: "set-cat-hover", active: true };
  // @ts-expect-error presentation History belongs to the presentation machine
  const removedHistory: SafeGameAction = { type: "toggle-history" };
  void removedHover;
  void removedHistory;
});

test("generation reaches both inclusive endpoints, allows repeats, and rejects invalid bounds", () => {
  assert.equal(
    generateSafeCode(() => 0),
    1,
  );
  assert.equal(
    generateSafeCode(() => 0.9999999999999999),
    1000,
  );
  assert.equal(
    generateSafeCode(() => 0, 7, 7),
    7,
  );

  assert.throws(() => generateSafeCode(() => 0, 0, 10), RangeError);
  assert.throws(() => generateSafeCode(() => 0, 1.5, 10), RangeError);
  assert.throws(() => generateSafeCode(() => 0, 10, 9), RangeError);

  const priorRound = createSafeGameState(777);
  const nextRound = apply(priorRound, { type: "new-round", code: 777 });
  assert.equal(
    nextRound.code,
    priorRound.code,
    "a new round may repeat the previous code",
  );
  assert.equal(
    roundIdOf(priorRound),
    1,
    "a newly created game starts at public round identity 1",
  );
  assert.equal(
    roundIdOf(nextRound),
    2,
    "every new round advances identity even when its code repeats",
  );
});

test("normalization accepts only trimmed whole decimal 1..1000 values and normalizes leading zeroes", () => {
  assert.deepEqual(normalizeSafeGuess(" 0007 "), { valid: true, value: 7 });
  assert.deepEqual(normalizeSafeGuess("1000"), { valid: true, value: 1000 });

  for (const rawInput of [
    "",
    "   ",
    "+7",
    "-7",
    "7.0",
    "1e2",
    "7x",
    "0",
    "0000",
    "1001",
  ]) {
    assert.deepEqual(
      normalizeSafeGuess(rawInput),
      { valid: false },
      `${JSON.stringify(rawInput)} must be rejected by the public normalization contract`,
    );
  }
});

test("invalid attempts are excluded and a valid wrong code remains playable with neutral feedback", () => {
  const initial = createSafeGameState(42);
  const invalid = apply(
    initial,
    { type: "set-input", input: " 7.0 " },
    { type: "submit-guess" },
  );

  assert.equal(invalid.phase, "playing");
  assert.equal(invalid.feedback, "invalid");
  assert.deepEqual(invalid.attempts, []);
  assert.equal(invalid.safeOpen, false);

  const wrong = apply(
    invalid,
    { type: "set-input", input: " 0007 " },
    { type: "submit-guess" },
  );
  assert.equal(wrong.phase, "playing");
  assert.equal(wrong.feedback, "wrong");
  assert.equal(wrong.safeOpen, false);
  assert.deepEqual(wrong.attempts, [7]);
  assert.equal(wrong.revealedCode, null);
  assert.equal(
    wrong.feedback,
    "wrong",
    "the domain exposes only a neutral wrong-result category, never secret-comparison guidance",
  );
  assert.equal(Object.hasOwn(wrong, "catReaction"), false);
  assert.equal(Object.hasOwn(wrong, "historyVisible"), false);
});

test("a correct normalized guess atomically wins and every terminal interaction is a no-op", () => {
  const won = apply(
    createSafeGameState(42),
    { type: "set-input", input: "0042" },
    { type: "submit-guess" },
  );

  assert.deepEqual(won, {
    code: 42,
    roundId: 1,
    phase: "won",
    input: "0042",
    feedback: "won",
    safeOpen: true,
    revealedCode: null,
    attempts: [42],
    hintChallenge: null,
    hintFeedback: "none",
    revealedMathAnswer: null,
    earnedHint: null,
    shownHint: null,
    earnedHintFacts: [],
    issuedHintPredicateIds: [],
    activeHintPredicateId: null,
    latestAwardedFactId: null,
  });

  const afterTerminalEvents = apply(
    won,
    { type: "set-input", input: "9" },
    { type: "submit-guess" },
    { type: "surrender" },
  );
  assert.deepEqual(afterTerminalEvents, won);
});

test("surrender is terminal, attempts are value-deduplicated, and a new round fully resets", () => {
  const withRepeatedWrongGuess = apply(
    createSafeGameState(42),
    { type: "set-input", input: "7" },
    { type: "submit-guess" },
    { type: "set-input", input: "0007" },
    { type: "submit-guess" },
  );
  assert.deepEqual(withRepeatedWrongGuess.attempts, [7]);

  const surrendered = apply(withRepeatedWrongGuess, { type: "surrender" });
  assert.deepEqual(surrendered, {
    code: 42,
    roundId: 1,
    phase: "surrendered",
    input: "0007",
    feedback: "surrendered",
    safeOpen: false,
    revealedCode: 42,
    attempts: [7],
    hintChallenge: null,
    hintFeedback: "none",
    revealedMathAnswer: null,
    earnedHint: null,
    shownHint: null,
    earnedHintFacts: [],
    issuedHintPredicateIds: [],
    activeHintPredicateId: null,
    latestAwardedFactId: null,
  });
  assert.deepEqual(
    apply(
      surrendered,
      { type: "set-input", input: "42" },
      { type: "submit-guess" },
      { type: "surrender" },
    ),
    surrendered,
    "terminal submit and surrender cannot change a completed round",
  );

  const reset = apply(surrendered, { type: "new-round", code: 9 });
  assert.deepEqual(reset, {
    code: 9,
    roundId: 2,
    phase: "playing",
    input: "",
    feedback: "none",
    safeOpen: false,
    revealedCode: null,
    attempts: [],
    hintChallenge: null,
    hintFeedback: "none",
    revealedMathAnswer: null,
    earnedHint: null,
    shownHint: null,
    earnedHintFacts: [],
    issuedHintPredicateIds: [],
    activeHintPredicateId: null,
    latestAwardedFactId: null,
  });
});
