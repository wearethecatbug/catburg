import assert from "node:assert/strict";
import test from "node:test";

import {
  createSafeGameState,
  generateSafeCode,
  normalizeSafeGuess,
  reduceSafeGame,
} from "@/domain/safe-game";

type SafeGameAction = Parameters<typeof reduceSafeGame>[1];

function apply(state: ReturnType<typeof createSafeGameState>, ...actions: SafeGameAction[]) {
  return actions.reduce(reduceSafeGame, state);
}

function roundIdOf(state: object) {
  return (state as Record<string, unknown>).roundId;
}

test("generation reaches both inclusive endpoints, allows repeats, and rejects invalid bounds", () => {
  assert.equal(generateSafeCode(() => 0), 1);
  assert.equal(generateSafeCode(() => 0.9999999999999999), 1000);
  assert.equal(generateSafeCode(() => 0, 7, 7), 7);

  assert.throws(() => generateSafeCode(() => 0, 0, 10), RangeError);
  assert.throws(() => generateSafeCode(() => 0, 1.5, 10), RangeError);
  assert.throws(() => generateSafeCode(() => 0, 10, 9), RangeError);

  const priorRound = createSafeGameState(777);
  const nextRound = apply(priorRound, { type: "new-round", code: 777 });
  assert.equal(nextRound.code, priorRound.code, "a new round may repeat the previous code");
  assert.equal(roundIdOf(priorRound), 1, "a newly created game starts at public round identity 1");
  assert.equal(roundIdOf(nextRound), 2, "every new round advances identity even when its code repeats");
});

test("normalization accepts only trimmed whole decimal 1..1000 values and normalizes leading zeroes", () => {
  assert.deepEqual(normalizeSafeGuess(" 0007 "), { valid: true, value: 7 });
  assert.deepEqual(normalizeSafeGuess("1000"), { valid: true, value: 1000 });

  for (const rawInput of ["", "   ", "+7", "-7", "7.0", "1e2", "7x", "0", "0000", "1001"]) {
    assert.deepEqual(
      normalizeSafeGuess(rawInput),
      { valid: false },
      `${JSON.stringify(rawInput)} must be rejected by the public normalization contract`,
    );
  }
});

test("invalid attempts are excluded and a valid wrong code remains playable with neutral feedback", () => {
  const initial = createSafeGameState(42);
  const invalid = apply(initial, { type: "set-input", input: " 7.0 " }, { type: "submit-guess" });

  assert.equal(invalid.phase, "playing");
  assert.equal(invalid.feedback, "invalid");
  assert.deepEqual(invalid.attempts, []);
  assert.equal(invalid.safeOpen, false);

  const wrong = apply(invalid, { type: "set-input", input: " 0007 " }, { type: "submit-guess" });
  assert.equal(wrong.phase, "playing");
  assert.equal(wrong.feedback, "wrong");
  assert.equal(wrong.catReaction, "wrong");
  assert.equal(wrong.safeOpen, false);
  assert.deepEqual(wrong.attempts, [7]);
  assert.equal(wrong.revealedCode, null);
  assert.equal(
    wrong.feedback,
    "wrong",
    "the domain exposes only a neutral wrong-result category, never secret-comparison guidance",
  );
});

test("a correct normalized guess atomically wins and every terminal interaction is a no-op", () => {
  const won = apply(
    createSafeGameState(42),
    { type: "set-input", input: "0042" },
    { type: "submit-guess" },
  );

  const wonHistoryOpen = apply(won, { type: "toggle-history" });
  assert.deepEqual(wonHistoryOpen, { ...won, historyVisible: true });
  assert.deepEqual(apply(wonHistoryOpen, { type: "toggle-history" }), won);
  assert.deepEqual(won, {
    code: 42,
    roundId: 1,
    phase: "won",
    input: "0042",
    feedback: "won",
    safeOpen: true,
    catReaction: "won",
    revealedCode: null,
    attempts: [42],
    historyVisible: false,
  });

  const afterTerminalEvents = apply(
    wonHistoryOpen,
    { type: "set-input", input: "9" },
    { type: "submit-guess" },
    { type: "surrender" },
    { type: "set-cat-hover", active: true },
  );
  assert.deepEqual(afterTerminalEvents, wonHistoryOpen);
});

test("surrender is terminal, history is value-deduplicated, and a new round fully resets", () => {
  const withRepeatedWrongGuess = apply(
    createSafeGameState(42),
    { type: "set-input", input: "7" },
    { type: "submit-guess" },
    { type: "set-input", input: "0007" },
    { type: "submit-guess" },
    { type: "toggle-history" },
  );
  assert.deepEqual(withRepeatedWrongGuess.attempts, [7]);
  assert.equal(withRepeatedWrongGuess.historyVisible, true);

  const surrendered = apply(withRepeatedWrongGuess, { type: "surrender" });
  const surrenderedHistoryClosed = apply(surrendered, { type: "toggle-history" });
  assert.deepEqual(surrenderedHistoryClosed, { ...surrendered, historyVisible: false });
  assert.deepEqual(apply(surrenderedHistoryClosed, { type: "toggle-history" }), surrendered);
  assert.deepEqual(surrendered, {
    code: 42,
    roundId: 1,
    phase: "surrendered",
    input: "0007",
    feedback: "surrendered",
    safeOpen: false,
    catReaction: "surrendered",
    revealedCode: 42,
    attempts: [7],
    historyVisible: true,
  });
  assert.deepEqual(
    apply(surrenderedHistoryClosed, { type: "set-input", input: "42" }, { type: "submit-guess" }, { type: "surrender" }, { type: "set-cat-hover", active: true }),
    surrenderedHistoryClosed,
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
    catReaction: "idle",
    revealedCode: null,
    attempts: [],
    historyVisible: false,
  });
});
