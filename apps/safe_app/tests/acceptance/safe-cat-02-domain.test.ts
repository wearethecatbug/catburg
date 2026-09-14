import assert from "node:assert/strict";
import test from "node:test";

import {
  createHintChallenge,
  createSafeGameState,
  reduceSafeGame,
} from "@/features/safe-game/domain";
import type {
  HintChallenge,
  HintOperator,
  SafeGameAction,
  SafeGameState,
} from "@/features/safe-game/domain";

function initialState(code: number): SafeGameState {
  return createSafeGameState(code);
}

function createChallenge(
  random: () => number,
  roundId: number,
  operator: HintOperator,
  challengeId: string,
): HintChallenge {
  return createHintChallenge(random, roundId, operator, challengeId);
}

function apply(state: SafeGameState, ...actions: SafeGameAction[]) {
  return actions.reduce(reduceSafeGame, state);
}

test("F01: New game atomically clears a pending or earned hint and History while advancing the round", () => {
  const initial = initialState(1000);
  const challenge = createChallenge(() => 0, initial.roundId, "+", "f01");
  const opened = apply(initial, { type: "show-hint", challenge });
  const earned = apply(opened, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
    answer: challenge.expectedAnswer,
  });
  const reset = apply(
    { ...earned, historyVisible: true },
    { type: "new-round", code: 1 },
  );

  assert.deepEqual(
    {
      roundId: reset.roundId,
      input: reset.input,
      feedback: reset.feedback,
      attempts: reset.attempts,
      historyVisible: reset.historyVisible,
      hintChallenge: reset.hintChallenge,
      hintFeedback: reset.hintFeedback,
      revealedMathAnswer: reset.revealedMathAnswer,
      earnedHint: reset.earnedHint,
      shownHint: reset.shownHint,
      earnedHintFacts: reset.earnedHintFacts,
      issuedHintPredicateIds: reset.issuedHintPredicateIds,
      activeHintPredicateId: reset.activeHintPredicateId,
      latestAwardedFactId: reset.latestAwardedFactId,
    },
    {
      roundId: initial.roundId + 1,
      input: "",
      feedback: "none",
      attempts: [],
      historyVisible: false,
      hintChallenge: null,
      hintFeedback: "none",
      revealedMathAnswer: null,
      earnedHint: null,
      shownHint: null,
      earnedHintFacts: [],
      issuedHintPredicateIds: [],
      activeHintPredicateId: null,
      latestAwardedFactId: null,
    },
  );
});

test("F02/F04: Show hint opens a new eligible challenge after an award, and guesses require explicit close", () => {
  const initial = initialState(42);
  const challenge = createChallenge(() => 0, initial.roundId, "+", "f02");
  const opened = apply(initial, { type: "show-hint", challenge });
  assert.deepEqual(opened.hintChallenge, challenge);
  assert.equal(opened.earnedHint, null);
  assert.equal(opened.shownHint, null);

  const earned = apply(opened, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
    answer: challenge.expectedAnswer,
  });
  assert.equal(earned.hintChallenge, null);
  assert.equal(earned.earnedHint, "even");
  assert.equal(earned.earnedHintFacts.length, 1);

  const repeatedChallenge = createChallenge(
    () => 0.9,
    initial.roundId,
    "+",
    "f02-repeat",
  );
  const repeated = apply(earned, {
    type: "show-hint",
    challenge: repeatedChallenge,
  });
  assert.deepEqual(
    repeated.hintChallenge,
    repeatedChallenge,
    "an earned fact must not lock out the next eligible challenge",
  );
  assert.equal(repeated.earnedHint, "even");
  assert.equal(repeated.earnedHintFacts.length, 1);
  const guardedGuess = apply(
    repeated,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  assert.deepEqual(
    guardedGuess.attempts,
    repeated.attempts,
    "a pending challenge guards guess submission",
  );
  const closed = apply(repeated, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: repeatedChallenge.challengeId,
  });
  const won = apply(
    closed,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  assert.equal(
    won.phase,
    "won",
    "guess submission resumes only after explicit challenge close",
  );
});

test("F03: controlled randomness preserves exact inclusive addition defaults and round identity", () => {
  const low = createChallenge(() => 0, 7, "+", "f03-low");
  const high = createChallenge(() => 0.9999999999999999, 7, "+", "f03-high");
  assert.deepEqual(low, {
    roundId: 7,
    challengeId: "f03-low",
    operator: "+",
    leftOperand: 1,
    rightOperand: 1,
    expectedAnswer: 2,
  });
  assert.deepEqual(high, {
    roundId: 7,
    challengeId: "f03-high",
    operator: "+",
    leftOperand: 10,
    rightOperand: 10,
    expectedAnswer: 20,
  });

  const playing = initialState(99);
  const playingChallenge = createChallenge(
    () => 0,
    playing.roundId,
    "+",
    "f03-playing",
  );
  const wrong = apply(
    playing,
    { type: "show-hint", challenge: playingChallenge },
    {
      type: "submit-hint-answer",
      roundId: playing.roundId,
      challengeId: playingChallenge.challengeId,
      answer: 1,
    },
  );
  assert.deepEqual(wrong.hintChallenge, playingChallenge);
  assert.equal(wrong.hintFeedback, "try-again");
  assert.equal(wrong.earnedHint, null);
  assert.equal(wrong.shownHint, null);
});

test("C14/F03: the selected operator is an explicit four-symbol contract and each generated challenge computes it truthfully", () => {
  const operators: HintOperator[] = ["+", "-", "×", "÷"];
  const randomValues = [0.1, 0.8, 0.4, 0.6];

  for (const operator of operators) {
    let position = 0;
    const random = () => randomValues[position++ % randomValues.length];
    const challenge = createChallenge(random, 13, operator, `f03-${operator}`);

    assert.equal(challenge.roundId, 13);
    assert.equal(challenge.operator, operator);
    assert.ok(Number.isInteger(challenge.leftOperand));
    assert.ok(Number.isInteger(challenge.rightOperand));
    assert.ok(Number.isInteger(challenge.expectedAnswer));
    assert.ok(challenge.leftOperand >= 1);
    assert.ok(challenge.rightOperand >= 1);

    if (operator === "+")
      assert.equal(
        challenge.expectedAnswer,
        challenge.leftOperand + challenge.rightOperand,
      );
    if (operator === "-") {
      assert.ok(
        challenge.leftOperand >= challenge.rightOperand,
        "subtraction must never require a negative answer",
      );
      assert.equal(
        challenge.expectedAnswer,
        challenge.leftOperand - challenge.rightOperand,
      );
    }
    if (operator === "×")
      assert.equal(
        challenge.expectedAnswer,
        challenge.leftOperand * challenge.rightOperand,
      );
    if (operator === "÷") {
      assert.equal(
        challenge.leftOperand % challenge.rightOperand,
        0,
        "division must be exact",
      );
      assert.equal(
        challenge.expectedAnswer,
        challenge.leftOperand / challenge.rightOperand,
      );
    }
  }
});

test("C14/F03: Show hint rejects a caller-supplied challenge whose displayed equation disagrees with its answer", () => {
  const initial = initialState(42);
  const inconsistent: HintChallenge = {
    roundId: initial.roundId,
    challengeId: "inconsistent-equation",
    operator: "+",
    leftOperand: 2,
    rightOperand: 3,
    expectedAnswer: 42,
  };

  assert.equal(
    reduceSafeGame(initial, { type: "show-hint", challenge: inconsistent }),
    initial,
    "the reducer must not expose or award a mathematically inconsistent challenge",
  );
});

test("C14/F03: a fixed random sequence makes every operator challenge deterministic", () => {
  const sequence = [0.06, 0.73, 0.41, 0.9];
  for (const operator of ["+", "-", "×", "÷"] as const) {
    let firstIndex = 0;
    let secondIndex = 0;
    const first = createChallenge(
      () => sequence[firstIndex++ % sequence.length],
      21,
      operator,
      `deterministic-${operator}`,
    );
    const second = createChallenge(
      () => sequence[secondIndex++ % sequence.length],
      21,
      operator,
      `deterministic-${operator}`,
    );
    assert.deepEqual(
      first,
      second,
      `${operator} must not use ambient randomness outside the injected source`,
    );
  }
});

test("C15/F06: the public factory preserves a caller-supplied unique challenge instance token", () => {
  const first = createChallenge(() => 0.2, 31, "+", "challenge-31-a");
  const second = createChallenge(() => 0.2, 31, "+", "challenge-31-b");

  assert.equal(first.challengeId, "challenge-31-a");
  assert.equal(second.challengeId, "challenge-31-b");
  assert.notEqual(
    first.challengeId,
    second.challengeId,
    "same-round questions need distinct callback identities",
  );
});

function openReplacementWithCollidingAnswer() {
  const initial = initialState(64);
  const original = createChallenge(
    () => 0,
    initial.roundId,
    "+",
    "challenge-64-a",
  );
  // Deliberately retain the exact answer: round identity and arithmetic equality cannot identify a
  // dialog instance.
  const replacement: HintChallenge = {
    ...original,
    challengeId: "challenge-64-b",
  };
  const opened = apply(initial, { type: "show-hint", challenge: original });
  const discarded = apply(opened, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: original.challengeId,
  });
  const replaced = apply(discarded, {
    type: "show-hint",
    challenge: replacement,
  });
  return { initial, original, replacement, replaced };
}

test("C15/F06: a stale submit cannot earn a hint when the replacement has the same expected answer", () => {
  const { initial, original, replaced } = openReplacementWithCollidingAnswer();
  const afterStaleSubmit = apply(replaced, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: original.challengeId,
    answer: original.expectedAnswer,
  });

  assert.deepEqual(
    afterStaleSubmit,
    replaced,
    "the answer callback must bind to the challenge instance, not just roundId and arithmetic value",
  );
});

test("C15/F06: a stale close callback cannot close the replacement challenge", () => {
  const { initial, original, replaced } = openReplacementWithCollidingAnswer();
  const afterStaleClose = apply(replaced, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: original.challengeId,
  });

  assert.deepEqual(afterStaleClose, replaced);
});

test("C15/F06: a stale Give Up callback cannot disclose the replacement math answer", () => {
  const { initial, original, replaced } = openReplacementWithCollidingAnswer();
  const afterStaleGiveUp = apply(replaced, {
    type: "give-up-hint-challenge",
    roundId: initial.roundId,
    challengeId: original.challengeId,
  });

  assert.deepEqual(afterStaleGiveUp, replaced);
});

test("C15/F06: a stale direct replacement callback cannot replace the explicitly renewed challenge", () => {
  const { initial, original, replacement, replaced } =
    openReplacementWithCollidingAnswer();
  const third: HintChallenge = {
    ...replacement,
    challengeId: "challenge-64-c",
  };
  const afterStaleReplacement = apply(replaced, {
    type: "replace-hint-challenge",
    roundId: initial.roundId,
    challengeId: original.challengeId,
    challenge: third,
  });

  assert.deepEqual(afterStaleReplacement, replaced);
});

test("C16/F06: the challenge factory rejects absent and empty instance identifiers", () => {
  // This narrow cast reaches the runtime-invalid input path that the public TypeScript type
  // rejects.
  const malformedFactory = createHintChallenge as unknown as (
    random: () => number,
    roundId: number,
    operator: HintOperator,
    challengeId?: string,
  ) => HintChallenge;
  assert.throws(() => malformedFactory(() => 0.2, 52, "+"), RangeError);
  assert.throws(() => createHintChallenge(() => 0.2, 52, "+", ""), RangeError);
});

test("C16/F06: Show hint and New Hint refuse an unidentifiable challenge", () => {
  const initial = initialState(52);
  const missingId = {
    roundId: initial.roundId,
    operator: "+" as const,
    leftOperand: 2,
    rightOperand: 3,
    expectedAnswer: 5,
  } as unknown as HintChallenge;
  const emptyId: HintChallenge = { ...missingId, challengeId: "" };
  const valid: HintChallenge = { ...missingId, challengeId: "challenge-52-a" };
  const opened = reduceSafeGame(initial, {
    type: "show-hint",
    challenge: valid,
  });

  assert.deepEqual(
    reduceSafeGame(initial, { type: "show-hint", challenge: missingId }),
    initial,
  );
  assert.deepEqual(
    reduceSafeGame(initial, { type: "show-hint", challenge: emptyId }),
    initial,
  );
  assert.deepEqual(
    reduceSafeGame(opened, {
      type: "replace-hint-challenge",
      roundId: initial.roundId,
      challengeId: valid.challengeId,
      challenge: missingId,
    }),
    opened,
  );
  assert.deepEqual(
    reduceSafeGame(opened, {
      type: "replace-hint-challenge",
      roundId: initial.roundId,
      challengeId: valid.challengeId,
      challenge: emptyId,
    }),
    opened,
  );
});

test("C16/F06: Show hint treats deserialized malformed challenges as no-throw identity no-ops", () => {
  const initial = initialState(52);
  for (const [description, challenge] of [
    ["null", null],
    ["primitive", 17],
    ["partial object", { roundId: initial.roundId, challengeId: "partial" }],
  ]) {
    const action = {
      type: "show-hint",
      challenge,
    } as unknown as SafeGameAction;
    assert.doesNotThrow(
      () =>
        assert.equal(
          reduceSafeGame(initial, action),
          initial,
          `${description} deserialized challenge cannot mutate the game`,
        ),
      `${description} deserialized challenge cannot throw at the reducer boundary`,
    );
  }
});

test("C16/F06: absent or empty callback IDs cannot mutate a valid active challenge", () => {
  const initial = initialState(52);
  const valid: HintChallenge = {
    roundId: initial.roundId,
    challengeId: "challenge-52-a",
    operator: "+",
    leftOperand: 2,
    rightOperand: 3,
    expectedAnswer: 5,
  };
  const opened = reduceSafeGame(initial, {
    type: "show-hint",
    challenge: valid,
  });

  for (const challengeId of [undefined, ""]) {
    const unsafeActionId = challengeId as unknown as string;
    assert.deepEqual(
      reduceSafeGame(opened, {
        type: "submit-hint-answer",
        roundId: initial.roundId,
        challengeId: unsafeActionId,
        answer: 5,
      }),
      opened,
    );
    assert.deepEqual(
      reduceSafeGame(opened, {
        type: "close-hint-challenge",
        roundId: initial.roundId,
        challengeId: unsafeActionId,
      }),
      opened,
    );
    assert.deepEqual(
      reduceSafeGame(opened, {
        type: "give-up-hint-challenge",
        roundId: initial.roundId,
        challengeId: unsafeActionId,
      }),
      opened,
    );
    assert.deepEqual(
      reduceSafeGame(opened, {
        type: "replace-hint-challenge",
        roundId: initial.roundId,
        challengeId: unsafeActionId,
        challenge: { ...valid, challengeId: "challenge-52-b" },
      }),
      opened,
    );
  }
});

test("C14/F03/F04: a same-round replacement changes only the unsolved challenge and cannot earn a hint", () => {
  const initial = initialState(88);
  const first = createChallenge(
    () => 0,
    initial.roundId,
    "+",
    "c14-replace-first",
  );
  const replacement = createChallenge(
    () => 0.9,
    initial.roundId,
    "÷",
    "c14-replace-second",
  );
  const opened = apply(initial, { type: "show-hint", challenge: first });
  const directReplacement = apply(opened, {
    type: "replace-hint-challenge",
    roundId: initial.roundId,
    challengeId: first.challengeId!,
    challenge: replacement,
  });
  assert.deepEqual(
    directReplacement,
    opened,
    "direct replacement is rejected until the original identity is explicitly discarded",
  );
  const discarded = apply(opened, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: first.challengeId!,
  });
  const replaced = apply(discarded, {
    type: "show-hint",
    challenge: replacement,
  });

  assert.deepEqual(replaced.hintChallenge, replacement);
  assert.equal(replaced.earnedHint, null);
  assert.equal(replaced.shownHint, null);
  assert.equal(replaced.hintFeedback, "none");
  assert.equal(replaced.revealedMathAnswer, null);

  const staleFirstAnswer = apply(replaced, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: first.challengeId!,
    answer: first.expectedAnswer,
  });
  assert.deepEqual(
    staleFirstAnswer.hintChallenge,
    replacement,
    "replacing a question must invalidate its prior answer",
  );
  assert.equal(staleFirstAnswer.earnedHint, null);
});

test("C14/F03/F04: Give Up reveals only this math answer, then a newly solved question is still required for a safe hint", () => {
  const initial = initialState(1000);
  const abandoned = createChallenge(
    () => 0,
    initial.roundId,
    "+",
    "c14-give-up-first",
  );
  const next = createChallenge(
    () => 0.8,
    initial.roundId,
    "×",
    "c14-give-up-next",
  );
  const opened = apply(initial, { type: "show-hint", challenge: abandoned });
  const gaveUp = apply(opened, {
    type: "give-up-hint-challenge",
    roundId: initial.roundId,
    challengeId: abandoned.challengeId!,
  });

  assert.deepEqual(
    gaveUp.hintChallenge,
    abandoned,
    "Give Up keeps the current math-only challenge available for its answer disclosure",
  );
  assert.equal(gaveUp.revealedMathAnswer, abandoned.expectedAnswer);
  assert.notEqual(
    gaveUp.revealedMathAnswer,
    initial.code,
    "Give Up must never disclose the safe code",
  );
  assert.equal(gaveUp.earnedHint, null);
  assert.equal(gaveUp.shownHint, null);

  const abandonedAnswer = apply(gaveUp, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: abandoned.challengeId!,
    answer: abandoned.expectedAnswer,
  });
  assert.equal(
    abandonedAnswer.earnedHint,
    null,
    "the revealed question cannot be used to earn the safe hint",
  );

  const discarded = apply(gaveUp, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: abandoned.challengeId!,
  });
  const replaced = apply(discarded, { type: "show-hint", challenge: next });
  assert.deepEqual(replaced.hintChallenge, next);
  assert.equal(
    replaced.revealedMathAnswer,
    null,
    "New Hint clears the prior math answer disclosure",
  );
  const earned = apply(replaced, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: next.challengeId!,
    answer: next.expectedAnswer,
  });
  assert.equal(earned.earnedHint, "even");
  assert.equal(earned.revealedMathAnswer, null);
});

test("C14/F06: Give Up cannot disclose math answers in a stale or terminal round", () => {
  const initial = initialState(100);
  const challenge = createChallenge(
    () => 0.2,
    initial.roundId,
    "÷",
    "c14-stale-give-up",
  );
  const opened = apply(initial, { type: "show-hint", challenge });
  const nextRound = apply(opened, { type: "new-round", code: 101 });
  assert.deepEqual(
    apply(nextRound, {
      type: "give-up-hint-challenge",
      roundId: initial.roundId,
      challengeId: challenge.challengeId!,
    }),
    nextRound,
    "a closed prior dialog must not disclose its answer into a new round",
  );

  const terminal = { ...initialState(8), phase: "won" as const };
  assert.deepEqual(
    apply(terminal, {
      type: "give-up-hint-challenge",
      roundId: terminal.roundId,
      challengeId: "terminal",
    }),
    terminal,
    "terminal rounds cannot disclose or earn a hint",
  );
});

test("C14/F06: replacement rejects stale, terminal, and already-earned rounds without changing state", () => {
  const initial = initialState(10);
  const active = createChallenge(() => 0.1, initial.roundId, "-", "c14-active");
  const stale = createChallenge(
    () => 0.9,
    initial.roundId + 1,
    "×",
    "c14-stale",
  );
  const opened = apply(initial, { type: "show-hint", challenge: active });
  assert.deepEqual(
    apply(opened, {
      type: "replace-hint-challenge",
      roundId: initial.roundId,
      challengeId: active.challengeId!,
      challenge: stale,
    }),
    opened,
  );

  const earned = apply(opened, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: active.challengeId!,
    answer: active.expectedAnswer,
  });
  const earnedReplacement = createChallenge(
    () => 0.3,
    initial.roundId,
    "÷",
    "c14-earned-replacement",
  );
  assert.deepEqual(
    apply(earned, {
      type: "replace-hint-challenge",
      roundId: initial.roundId,
      challengeId: active.challengeId!,
      challenge: earnedReplacement,
    }),
    earned,
  );

  const terminal = { ...initialState(9), phase: "surrendered" as const };
  const terminalReplacement = createChallenge(
    () => 0.5,
    terminal.roundId,
    "×",
    "c14-terminal-replacement",
  );
  assert.deepEqual(
    apply(terminal, {
      type: "replace-hint-challenge",
      roundId: terminal.roundId,
      challengeId: "terminal",
      challenge: terminalReplacement,
    }),
    terminal,
  );
});

test("F03/F05: invalid or wrong answers keep the challenge open; closing earns nothing", () => {
  const initial = initialState(101);
  const challenge = createChallenge(() => 0.2, initial.roundId, "+", "f03-f05");
  const opened = apply(initial, { type: "show-hint", challenge });
  const invalid = apply(opened, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: challenge.challengeId!,
    answer: null,
  });
  assert.deepEqual(invalid.hintChallenge, challenge);
  assert.equal(invalid.hintFeedback, "try-again");
  assert.equal(invalid.earnedHint, null);

  const closed = apply(invalid, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: challenge.challengeId!,
  });
  assert.equal(closed.hintChallenge, null);
  assert.equal(closed.earnedHint, null);
  assert.equal(closed.shownHint, null);
});

// Keep the expected shape static so optional-property regressions cannot mirror the state under
// test.
const canonicalGameStateKeys = [
  "activeHintPredicateId",
  "attempts",
  "catReaction",
  "code",
  "earnedHint",
  "earnedHintFacts",
  "feedback",
  "hintChallenge",
  "hintFeedback",
  "historyVisible",
  "input",
  "issuedHintPredicateIds",
  "latestAwardedFactId",
  "phase",
  "revealedCode",
  "revealedMathAnswer",
  "roundId",
  "safeOpen",
  "shownHint",
];

function assertCanonicalStateKeys(state: SafeGameState, description: string) {
  assert.deepEqual(
    Object.keys(state).sort(),
    canonicalGameStateKeys,
    description,
  );
}

function openChallengeAndAnswerWrong(code: number, challengeId: string) {
  const initial = initialState(code);
  const challenge = createChallenge(() => 0, initial.roundId, "+", challengeId);
  const opened = apply(initial, { type: "show-hint", challenge });
  const wrong = apply(opened, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
    answer: null,
  });
  assert.deepEqual(
    wrong.hintChallenge,
    challenge,
    "a rejected answer keeps the current challenge open",
  );
  assert.equal(
    wrong.hintFeedback,
    "try-again",
    "a rejected answer has explicit challenge feedback",
  );
  return { initial, challenge, wrong };
}

test("a new round initializes the canonical math-answer field", () => {
  const initial = initialState(42);
  assertCanonicalStateKeys(
    initial,
    "a new round has every canonical state key",
  );
  assert.equal(initial.revealedMathAnswer, null);
});

test("closing a disclosed challenge clears all challenge-scoped state", () => {
  const { initial, challenge, wrong } = openChallengeAndAnswerWrong(
    42,
    "a02-close",
  );
  const disclosed = apply(wrong, {
    type: "give-up-hint-challenge",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
  });
  assert.equal(disclosed.revealedMathAnswer, challenge.expectedAnswer);
  const closed = apply(disclosed, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
  });
  assertCanonicalStateKeys(closed, "closing keeps the canonical state shape");
  assert.deepEqual(
    {
      hintChallenge: closed.hintChallenge,
      hintFeedback: closed.hintFeedback,
      revealedMathAnswer: closed.revealedMathAnswer,
    },
    { hintChallenge: null, hintFeedback: "none", revealedMathAnswer: null },
  );
});

test("winning after an open rejected challenge requires explicit close and clears its challenge state", () => {
  const { initial, challenge, wrong } = openChallengeAndAnswerWrong(
    42,
    "a02-win",
  );
  const guarded = apply(
    wrong,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  assert.equal(
    guarded.phase,
    "playing",
    "an active challenge guards a correct guess too",
  );
  const closed = apply(wrong, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
  });
  const won = apply(
    closed,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  assert.equal(won.phase, "won");
  assert.deepEqual(
    {
      hintChallenge: won.hintChallenge,
      hintFeedback: won.hintFeedback,
      revealedMathAnswer: won.revealedMathAnswer,
    },
    { hintChallenge: null, hintFeedback: "none", revealedMathAnswer: null },
  );
  assert.deepEqual(
    apply(won, {
      type: "submit-hint-answer",
      roundId: initial.roundId,
      challengeId: challenge.challengeId,
      answer: challenge.expectedAnswer,
    }),
    won,
    "a terminal callback from the open challenge cannot mutate a won round",
  );
});

test("surrendering after an open rejected challenge clears its challenge state", () => {
  const { initial, challenge, wrong } = openChallengeAndAnswerWrong(
    42,
    "a02-surrender",
  );
  const surrendered = apply(wrong, { type: "surrender" });
  assert.equal(surrendered.phase, "surrendered");
  assert.deepEqual(
    {
      hintChallenge: surrendered.hintChallenge,
      hintFeedback: surrendered.hintFeedback,
      revealedMathAnswer: surrendered.revealedMathAnswer,
    },
    { hintChallenge: null, hintFeedback: "none", revealedMathAnswer: null },
  );
  assert.deepEqual(
    apply(surrendered, {
      type: "close-hint-challenge",
      roundId: initial.roundId,
      challengeId: challenge.challengeId,
    }),
    surrendered,
    "a terminal close callback cannot mutate a surrendered round",
  );
});

test("terminal win retains the canonical state keys", () => {
  const winScenario = openChallengeAndAnswerWrong(42, "a02-terminal-keys-win");
  const closed = apply(winScenario.wrong, {
    type: "close-hint-challenge",
    roundId: winScenario.initial.roundId,
    challengeId: winScenario.challenge.challengeId,
  });
  assert.equal(
    closed.hintChallenge,
    null,
    "terminal setup closes the active challenge",
  );
  const won = apply(
    closed,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  assert.equal(won.phase, "won", "the terminal-win scenario reaches won");
  assertCanonicalStateKeys(won, "winning keeps the canonical state shape");
});

test("terminal surrender retains the canonical state keys", () => {
  const surrenderScenario = openChallengeAndAnswerWrong(
    42,
    "a02-terminal-keys-surrender",
  );
  const surrendered = apply(surrenderScenario.wrong, { type: "surrender" });
  assertCanonicalStateKeys(
    surrendered,
    "surrendering keeps the canonical state shape",
  );
});

test("a same-code restart after a terminal round rebuilds canonical state", () => {
  const { initial, challenge, wrong } = openChallengeAndAnswerWrong(
    42,
    "a02-restart",
  );
  const closed = apply(wrong, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
  });
  assert.equal(
    closed.hintChallenge,
    null,
    "restart setup closes the active challenge",
  );
  const won = apply(
    closed,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  assert.equal(
    won.phase,
    "won",
    "restart setup reaches the terminal win state",
  );
  const restarted = apply(won, { type: "new-round", code: 42 });
  assert.equal(restarted.roundId, initial.roundId + 1);
  assert.equal(restarted.code, initial.code);
  assertCanonicalStateKeys(
    restarted,
    "a same-code restart rebuilds every canonical state key",
  );
  assert.equal(restarted.hintChallenge, null);
  assert.equal(restarted.hintFeedback, "none");
  assert.equal(restarted.revealedMathAnswer, null);
});

test("a same-code restart rejects stale actions from the terminal round", () => {
  const { initial, challenge, wrong } = openChallengeAndAnswerWrong(
    42,
    "a02-restart-stale",
  );
  const closed = apply(wrong, {
    type: "close-hint-challenge",
    roundId: initial.roundId,
    challengeId: challenge.challengeId,
  });
  assert.equal(
    closed.hintChallenge,
    null,
    "stale-callback setup closes the active challenge",
  );
  const won = apply(
    closed,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  assert.equal(
    won.phase,
    "won",
    "stale-callback setup reaches the terminal win state",
  );
  const restarted = apply(won, { type: "new-round", code: 42 });
  assert.deepEqual(
    apply(restarted, {
      type: "give-up-hint-challenge",
      roundId: initial.roundId,
      challengeId: challenge.challengeId,
    }),
    restarted,
    "a callback from the prior terminal round cannot disclose into a same-code restart",
  );
});

test("F04/F06: parity is truthful at odd/even boundaries and stale or terminal answers cannot mutate a round", () => {
  const odd = initialState(1);
  const oddChallenge = createChallenge(() => 0, odd.roundId, "+", "f04-odd");
  const oddEarned = apply(
    apply(odd, { type: "show-hint", challenge: oddChallenge }),
    {
      type: "submit-hint-answer",
      roundId: odd.roundId,
      challengeId: oddChallenge.challengeId!,
      answer: oddChallenge.expectedAnswer,
    },
  );
  assert.equal(oddEarned.earnedHint, "odd");

  const even = initialState(1000);
  const staleChallenge = createChallenge(
    () => 0.4,
    even.roundId,
    "+",
    "f04-stale",
  );
  const nextRound = apply(even, { type: "new-round", code: 2 });
  const afterStaleAnswer = apply(nextRound, {
    type: "submit-hint-answer",
    roundId: staleChallenge.roundId,
    challengeId: staleChallenge.challengeId!,
    answer: staleChallenge.expectedAnswer,
  });
  assert.deepEqual(
    afterStaleAnswer,
    nextRound,
    "a prior round callback must be rejected without mutation",
  );

  const terminal = { ...initialState(2), phase: "won" as const };
  const terminalAfterAnswer = apply(terminal, {
    type: "submit-hint-answer",
    roundId: terminal.roundId,
    challengeId: "terminal",
    answer: 2,
  });
  assert.deepEqual(
    terminalAfterAnswer,
    terminal,
    "terminal rounds cannot publish hints",
  );
});
