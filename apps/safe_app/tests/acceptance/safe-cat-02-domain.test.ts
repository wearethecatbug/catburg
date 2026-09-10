import assert from "node:assert/strict";
import test from "node:test";

import * as safeGameModule from "@/domain/safe-game";

type HintText = "The code is even." | "The code is odd.";
type HintOperator = "+" | "-" | "×" | "÷";

interface HintChallenge {
  roundId: number;
  challengeId?: string;
  operator: HintOperator;
  leftOperand: number;
  rightOperand: number;
  expectedAnswer: number;
}

interface TokenizedHintChallenge extends HintChallenge {
  challengeId: string;
}

interface FutureHintState {
  code: number;
  roundId: number;
  phase: "playing" | "won" | "surrendered";
  input: string;
  feedback: string;
  attempts: number[];
  historyVisible: boolean;
  hintChallenge: HintChallenge | null;
  hintFeedback: "none" | "try-again";
  revealedMathAnswer: number | null;
  earnedHint: HintText | null;
  shownHint: HintText | null;
}

type HintAction =
  | { type: "show-hint"; challenge: HintChallenge }
  | { type: "replace-hint-challenge"; roundId: number; challengeId: string; challenge: HintChallenge }
  | { type: "give-up-hint-challenge"; roundId: number; challengeId: string }
  | { type: "submit-hint-answer"; roundId: number; challengeId: string; answer: number | null }
  | { type: "close-hint-challenge"; roundId: number; challengeId: string };

type FutureHintApi = {
  createHintChallenge?: (random: () => number, roundId: number, operator: HintOperator, challengeId: string) => HintChallenge;
};

const futureHintApi = safeGameModule as unknown as FutureHintApi;
const reduce = safeGameModule.reduceSafeGame as unknown as (
  state: FutureHintState,
  action: HintAction | { type: "new-round"; code: number },
) => FutureHintState;

function initialState(code: number): FutureHintState {
  return safeGameModule.createSafeGameState(code) as unknown as FutureHintState;
}

function createChallenge(random: () => number, roundId: number, operator: HintOperator, challengeId: string): HintChallenge {
  const factory = futureHintApi.createHintChallenge;
  assert.equal(
    typeof factory,
    "function",
    "SAFE-CAT-02 requires an exported deterministic createHintChallenge(random, roundId) domain boundary",
  );
  if (!factory) {
    throw new Error("unreachable after assertion");
  }
  return factory(random, roundId, operator, challengeId);
}

function apply(state: FutureHintState, ...actions: Array<HintAction | { type: "new-round"; code: number }>) {
  return actions.reduce(reduce, state);
}

test("F01: New game atomically clears a pending or earned hint and History while advancing the round", () => {
  const initial = initialState(1000);
  const challenge = createChallenge(() => 0, initial.roundId, "+", "f01");
  const opened = apply(initial, { type: "show-hint", challenge });
  const earned = apply(opened, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: challenge.challengeId!,
    answer: challenge.expectedAnswer,
  });
  const reset = apply({ ...earned, historyVisible: true }, { type: "new-round", code: 1 });

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
    },
  );
});

test("F02/F04: Show hint opens one challenge before reward, then re-displays exactly the earned parity fact", () => {
  const initial = initialState(42);
  const challenge = createChallenge(() => 0, initial.roundId, "+", "f02");
  const opened = apply(initial, { type: "show-hint", challenge });
  assert.deepEqual(opened.hintChallenge, challenge);
  assert.equal(opened.earnedHint, null);
  assert.equal(opened.shownHint, null);

  const earned = apply(opened, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: challenge.challengeId!,
    answer: challenge.expectedAnswer,
  });
  assert.equal(earned.hintChallenge, null);
  assert.equal(earned.earnedHint, "The code is even.");

  const repeated = apply(earned, { type: "show-hint", challenge: createChallenge(() => 0.9, initial.roundId, "+", "f02-repeat") });
  assert.equal(repeated.hintChallenge, null, "an earned hint must not open a second challenge");
  assert.equal(repeated.earnedHint, "The code is even.");
  assert.equal(repeated.shownHint, "The code is even.");
  assert.notEqual(repeated.shownHint, String(repeated.code), "the hint path must never disclose the exact code");
});

test("F03: controlled randomness preserves exact inclusive addition defaults and round identity", () => {
  const low = createChallenge(() => 0, 7, "+", "f03-low");
  const high = createChallenge(() => 0.9999999999999999, 7, "+", "f03-high");
  assert.deepEqual(low, { roundId: 7, challengeId: "f03-low", operator: "+", leftOperand: 1, rightOperand: 1, expectedAnswer: 2 });
  assert.deepEqual(high, { roundId: 7, challengeId: "f03-high", operator: "+", leftOperand: 10, rightOperand: 10, expectedAnswer: 20 });

  const playing = initialState(99);
  const playingChallenge = createChallenge(() => 0, playing.roundId, "+", "f03-playing");
  const wrong = apply(
    playing,
    { type: "show-hint", challenge: playingChallenge },
    { type: "submit-hint-answer", roundId: playing.roundId, challengeId: playingChallenge.challengeId!, answer: 1 },
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

    if (operator === "+") assert.equal(challenge.expectedAnswer, challenge.leftOperand + challenge.rightOperand);
    if (operator === "-") {
      assert.ok(challenge.leftOperand >= challenge.rightOperand, "subtraction must never require a negative answer");
      assert.equal(challenge.expectedAnswer, challenge.leftOperand - challenge.rightOperand);
    }
    if (operator === "×") assert.equal(challenge.expectedAnswer, challenge.leftOperand * challenge.rightOperand);
    if (operator === "÷") {
      assert.equal(challenge.leftOperand % challenge.rightOperand, 0, "division must be exact");
      assert.equal(challenge.expectedAnswer, challenge.leftOperand / challenge.rightOperand);
    }
  }
});

test("C14/F03: a fixed random sequence makes every operator challenge deterministic", () => {
  const sequence = [0.06, 0.73, 0.41, 0.9];
  for (const operator of ["+", "-", "×", "÷"] as const) {
    let firstIndex = 0;
    let secondIndex = 0;
    const first = createChallenge(() => sequence[firstIndex++ % sequence.length], 21, operator, `deterministic-${operator}`);
    const second = createChallenge(() => sequence[secondIndex++ % sequence.length], 21, operator, `deterministic-${operator}`);
    assert.deepEqual(first, second, `${operator} must not use ambient randomness outside the injected source`);
  }
});

test("C15/F06: the public factory preserves a caller-supplied unique challenge instance token", () => {
  const first = createChallenge(() => 0.2, 31, "+", "challenge-31-a") as Partial<TokenizedHintChallenge>;
  const second = createChallenge(() => 0.2, 31, "+", "challenge-31-b") as Partial<TokenizedHintChallenge>;

  assert.equal(first.challengeId, "challenge-31-a");
  assert.equal(second.challengeId, "challenge-31-b");
  assert.notEqual(first.challengeId, second.challengeId, "same-round questions need distinct callback identities");
});

function openReplacementWithCollidingAnswer() {
  const initial = initialState(64);
  const original = createChallenge(() => 0, initial.roundId, "+", "challenge-64-a") as TokenizedHintChallenge;
  // Deliberately retain the exact answer: round identity and arithmetic equality cannot identify a dialog instance.
  const replacement: TokenizedHintChallenge = { ...original, challengeId: "challenge-64-b" };
  const opened = apply(initial, { type: "show-hint", challenge: original });
  const replaced = apply(opened, {
    type: "replace-hint-challenge",
    roundId: initial.roundId,
    challengeId: original.challengeId,
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

  assert.deepEqual(afterStaleSubmit, replaced, "the answer callback must bind to the challenge instance, not just roundId and arithmetic value");
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

test("C15/F06: a stale New Hint callback cannot replace the already replaced challenge", () => {
  const { initial, original, replacement, replaced } = openReplacementWithCollidingAnswer();
  const third: TokenizedHintChallenge = { ...replacement, challengeId: "challenge-64-c" };
  const afterStaleReplacement = apply(replaced, {
    type: "replace-hint-challenge",
    roundId: initial.roundId,
    challengeId: original.challengeId,
    challenge: third,
  });

  assert.deepEqual(afterStaleReplacement, replaced);
});

test("C16/F06: the challenge factory rejects absent and empty instance identifiers", () => {
  const factory = futureHintApi.createHintChallenge;
  assert.equal(typeof factory, "function");
  if (!factory) throw new Error("unreachable after assertion");

  assert.throws(() => (factory as unknown as (random: () => number, roundId: number, operator: HintOperator, challengeId?: string) => HintChallenge)(() => 0.2, 52, "+"), RangeError);
  assert.throws(() => factory(() => 0.2, 52, "+", ""), RangeError);
});

test("C16/F06: Show hint and New Hint refuse an unidentifiable challenge", () => {
  const initial = initialState(52);
  const missingId: HintChallenge = { roundId: initial.roundId, operator: "+", leftOperand: 2, rightOperand: 3, expectedAnswer: 5 };
  const emptyId: HintChallenge = { ...missingId, challengeId: "" };
  const valid: TokenizedHintChallenge = { ...missingId, challengeId: "challenge-52-a" };
  const opened = reduce(initial, { type: "show-hint", challenge: valid });

  assert.deepEqual(reduce(initial, { type: "show-hint", challenge: missingId }), initial);
  assert.deepEqual(reduce(initial, { type: "show-hint", challenge: emptyId }), initial);
  assert.deepEqual(
    reduce(opened, { type: "replace-hint-challenge", roundId: initial.roundId, challengeId: valid.challengeId, challenge: missingId }),
    opened,
  );
  assert.deepEqual(
    reduce(opened, { type: "replace-hint-challenge", roundId: initial.roundId, challengeId: valid.challengeId, challenge: emptyId }),
    opened,
  );
});

test("C16/F06: absent or empty callback IDs cannot mutate a valid active challenge", () => {
  const initial = initialState(52);
  const valid: TokenizedHintChallenge = {
    roundId: initial.roundId,
    challengeId: "challenge-52-a",
    operator: "+",
    leftOperand: 2,
    rightOperand: 3,
    expectedAnswer: 5,
  };
  const opened = reduce(initial, { type: "show-hint", challenge: valid });

  for (const challengeId of [undefined, ""]) {
    const unsafeActionId = challengeId as unknown as string;
    assert.deepEqual(reduce(opened, { type: "submit-hint-answer", roundId: initial.roundId, challengeId: unsafeActionId, answer: 5 }), opened);
    assert.deepEqual(reduce(opened, { type: "close-hint-challenge", roundId: initial.roundId, challengeId: unsafeActionId }), opened);
    assert.deepEqual(reduce(opened, { type: "give-up-hint-challenge", roundId: initial.roundId, challengeId: unsafeActionId }), opened);
    assert.deepEqual(
      reduce(opened, { type: "replace-hint-challenge", roundId: initial.roundId, challengeId: unsafeActionId, challenge: { ...valid, challengeId: "challenge-52-b" } }),
      opened,
    );
  }
});

test("C14/F03/F04: a same-round replacement changes only the unsolved challenge and cannot earn a hint", () => {
  const initial = initialState(88);
  const first = createChallenge(() => 0, initial.roundId, "+", "c14-replace-first");
  const replacement = createChallenge(() => 0.9, initial.roundId, "÷", "c14-replace-second");
  const opened = apply(initial, { type: "show-hint", challenge: first });
  const replaced = apply(opened, { type: "replace-hint-challenge", roundId: initial.roundId, challengeId: first.challengeId!, challenge: replacement });

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
  assert.deepEqual(staleFirstAnswer.hintChallenge, replacement, "replacing a question must invalidate its prior answer");
  assert.equal(staleFirstAnswer.earnedHint, null);
});

test("C14/F03/F04: Give Up reveals only this math answer, then a newly solved question is still required for a safe hint", () => {
  const initial = initialState(1000);
  const abandoned = createChallenge(() => 0, initial.roundId, "+", "c14-give-up-first");
  const next = createChallenge(() => 0.8, initial.roundId, "×", "c14-give-up-next");
  const opened = apply(initial, { type: "show-hint", challenge: abandoned });
  const gaveUp = apply(opened, { type: "give-up-hint-challenge", roundId: initial.roundId, challengeId: abandoned.challengeId! });

  assert.deepEqual(gaveUp.hintChallenge, abandoned, "Give Up keeps the current math-only challenge available for its answer disclosure");
  assert.equal(gaveUp.revealedMathAnswer, abandoned.expectedAnswer);
  assert.notEqual(gaveUp.revealedMathAnswer, initial.code, "Give Up must never disclose the safe code");
  assert.equal(gaveUp.earnedHint, null);
  assert.equal(gaveUp.shownHint, null);

  const abandonedAnswer = apply(gaveUp, {
    type: "submit-hint-answer",
    roundId: initial.roundId,
    challengeId: abandoned.challengeId!,
    answer: abandoned.expectedAnswer,
  });
  assert.equal(abandonedAnswer.earnedHint, null, "the revealed question cannot be used to earn the safe hint");

  const replaced = apply(gaveUp, { type: "replace-hint-challenge", roundId: initial.roundId, challengeId: abandoned.challengeId!, challenge: next });
  assert.deepEqual(replaced.hintChallenge, next);
  assert.equal(replaced.revealedMathAnswer, null, "New Hint clears the prior math answer disclosure");
  const earned = apply(replaced, { type: "submit-hint-answer", roundId: initial.roundId, challengeId: next.challengeId!, answer: next.expectedAnswer });
  assert.equal(earned.earnedHint, "The code is even.");
  assert.equal(earned.revealedMathAnswer, null);
});

test("C14/F06: Give Up cannot disclose math answers in a stale or terminal round", () => {
  const initial = initialState(100);
  const challenge = createChallenge(() => 0.2, initial.roundId, "÷", "c14-stale-give-up");
  const opened = apply(initial, { type: "show-hint", challenge });
  const nextRound = apply(opened, { type: "new-round", code: 101 });
  assert.deepEqual(
    apply(nextRound, { type: "give-up-hint-challenge", roundId: initial.roundId, challengeId: challenge.challengeId! }),
    nextRound,
    "a closed prior dialog must not disclose its answer into a new round",
  );

  const terminal = { ...initialState(8), phase: "won" as const };
  assert.deepEqual(
    apply(terminal, { type: "give-up-hint-challenge", roundId: terminal.roundId, challengeId: "terminal" }),
    terminal,
    "terminal rounds cannot disclose or earn a hint",
  );
});

test("C14/F06: replacement rejects stale, terminal, and already-earned rounds without changing state", () => {
  const initial = initialState(10);
  const active = createChallenge(() => 0.1, initial.roundId, "-", "c14-active");
  const stale = createChallenge(() => 0.9, initial.roundId + 1, "×", "c14-stale");
  const opened = apply(initial, { type: "show-hint", challenge: active });
  assert.deepEqual(apply(opened, { type: "replace-hint-challenge", roundId: initial.roundId, challengeId: active.challengeId!, challenge: stale }), opened);

  const earned = apply(opened, { type: "submit-hint-answer", roundId: initial.roundId, challengeId: active.challengeId!, answer: active.expectedAnswer });
  const earnedReplacement = createChallenge(() => 0.3, initial.roundId, "÷", "c14-earned-replacement");
  assert.deepEqual(apply(earned, { type: "replace-hint-challenge", roundId: initial.roundId, challengeId: active.challengeId!, challenge: earnedReplacement }), earned);

  const terminal = { ...initialState(9), phase: "surrendered" as const };
  const terminalReplacement = createChallenge(() => 0.5, terminal.roundId, "×", "c14-terminal-replacement");
  assert.deepEqual(apply(terminal, { type: "replace-hint-challenge", roundId: terminal.roundId, challengeId: "terminal", challenge: terminalReplacement }), terminal);
});

test("F03/F05: invalid or wrong answers keep the challenge open; closing earns nothing", () => {
  const initial = initialState(101);
  const challenge = createChallenge(() => 0.2, initial.roundId, "+", "f03-f05");
  const opened = apply(initial, { type: "show-hint", challenge });
  const invalid = apply(opened, { type: "submit-hint-answer", roundId: initial.roundId, challengeId: challenge.challengeId!, answer: null });
  assert.deepEqual(invalid.hintChallenge, challenge);
  assert.equal(invalid.hintFeedback, "try-again");
  assert.equal(invalid.earnedHint, null);

  const closed = apply(invalid, { type: "close-hint-challenge", roundId: initial.roundId, challengeId: challenge.challengeId! });
  assert.equal(closed.hintChallenge, null);
  assert.equal(closed.earnedHint, null);
  assert.equal(closed.shownHint, null);
});

test("F04/F06: parity is truthful at odd/even boundaries and stale or terminal answers cannot mutate a round", () => {
  const odd = initialState(1);
  const oddChallenge = createChallenge(() => 0, odd.roundId, "+", "f04-odd");
  const oddEarned = apply(apply(odd, { type: "show-hint", challenge: oddChallenge }), {
    type: "submit-hint-answer",
    roundId: odd.roundId,
    challengeId: oddChallenge.challengeId!,
    answer: oddChallenge.expectedAnswer,
  });
  assert.equal(oddEarned.earnedHint, "The code is odd.");

  const even = initialState(1000);
  const staleChallenge = createChallenge(() => 0.4, even.roundId, "+", "f04-stale");
  const nextRound = apply(even, { type: "new-round", code: 2 });
  const afterStaleAnswer = apply(nextRound, {
    type: "submit-hint-answer",
    roundId: staleChallenge.roundId,
    challengeId: staleChallenge.challengeId!,
    answer: staleChallenge.expectedAnswer,
  });
  assert.deepEqual(afterStaleAnswer, nextRound, "a prior round callback must be rejected without mutation");

  const terminal = { ...initialState(2), phase: "won" as const };
  const terminalAfterAnswer = apply(terminal, {
    type: "submit-hint-answer",
    roundId: terminal.roundId,
    challengeId: "terminal",
    answer: 2,
  });
  assert.deepEqual(terminalAfterAnswer, terminal, "terminal rounds cannot publish hints");
});
