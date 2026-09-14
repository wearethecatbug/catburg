import assert from "node:assert/strict";
import test from "node:test";

import {
  createHintChallenge,
  createSafeGameState,
  reduceSafeGame,
} from "@/features/safe-game/domain";
import { chooseNextHintPredicate } from "@/features/safe-game/domain/earned-hint-facts";
import { selectEarnedHintReadModel } from "@/features/safe-game/model/game.selectors";
import type {
  SafeGameAction,
  SafeGameState,
} from "@/features/safe-game/domain";

function apply(state: SafeGameState, ...actions: SafeGameAction[]) {
  return actions.reduce(reduceSafeGame, state);
}

function openChallenge(
  state: SafeGameState,
  challengeId = "earned-hint-current",
) {
  const predicate = chooseNextHintPredicate({
    facts: selectEarnedHintReadModel(state).facts,
    wrongAttempts: state.attempts,
    issuedPredicateIds: [],
  });
  assert.ok(predicate, "the test setup requires an eligible public predicate");
  const challenge = createHintChallenge(
    () => 0,
    state.roundId,
    "+",
    challengeId,
  );
  return apply(state, {
    type: "show-hint",
    challenge,
    predicateId: predicate.id,
  });
}

function answerActiveChallenge(state: SafeGameState) {
  const challenge = state.hintChallenge;
  assert.ok(challenge, "the test setup requires an active challenge");
  return apply(state, {
    type: "submit-hint-answer",
    roundId: challenge.roundId,
    challengeId: challenge.challengeId,
    answer: challenge.expectedAnswer,
  });
}

test("SC04 round: only one correct active answer awards exactly one public fact and repeated Show hint opens a new challenge", () => {
  const initial = createSafeGameState(42);
  const opened = openChallenge(initial);
  const originalChallenge = opened.hintChallenge!;
  const awarded = answerActiveChallenge(opened);
  const readModel = selectEarnedHintReadModel(awarded);

  assert.equal(readModel.roundId, initial.roundId);
  assert.equal(readModel.facts.length, 1);
  assert.equal(readModel.latestAwardedFactId, readModel.facts[0].id);
  assert.equal(
    "code" in readModel,
    false,
    "the presentation read model must never expose the private code",
  );
  assert.equal(
    awarded.hintChallenge,
    null,
    "a correct award closes this active challenge",
  );

  const duplicate = apply(awarded, {
    type: "submit-hint-answer",
    roundId: originalChallenge.roundId,
    challengeId: originalChallenge.challengeId,
    answer: originalChallenge.expectedAnswer,
  });
  assert.deepEqual(
    selectEarnedHintReadModel(duplicate),
    readModel,
    "a duplicate callback cannot award a second fact",
  );

  const second = openChallenge(awarded, "earned-hint-second");
  assert.ok(
    second.hintChallenge,
    "Show hint preflights another math question rather than replaying an old fact",
  );
  assert.notEqual(second.hintChallenge.challengeId, "earned-hint-current");
});

test("SC04 round: malformed, wrong, revealed, abandoned, stale, terminal, and active-guess actions do not create a reward", () => {
  const initial = createSafeGameState(42);
  const opened = openChallenge(initial);
  const challenge = opened.hintChallenge!;
  const publicBefore = selectEarnedHintReadModel(opened);

  const malformed = apply(opened, {
    type: "submit-hint-answer",
    roundId: challenge.roundId,
    challengeId: "",
    answer: challenge.expectedAnswer,
  });
  const wrong = apply(opened, {
    type: "submit-hint-answer",
    roundId: challenge.roundId,
    challengeId: challenge.challengeId,
    answer: challenge.expectedAnswer + 1,
  });
  const revealed = apply(
    opened,
    {
      type: "give-up-hint-challenge",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
    },
    {
      type: "submit-hint-answer",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
      answer: challenge.expectedAnswer,
    },
  );
  const abandoned = apply(
    opened,
    {
      type: "close-hint-challenge",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
    },
    {
      type: "submit-hint-answer",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
      answer: challenge.expectedAnswer,
    },
  );
  const stale = apply(opened, {
    type: "submit-hint-answer",
    roundId: challenge.roundId + 1,
    challengeId: challenge.challengeId,
    answer: challenge.expectedAnswer,
  });
  const activeGuess = apply(
    opened,
    { type: "set-input", input: "7" },
    { type: "submit-guess" },
  );
  const won = apply(
    opened,
    { type: "new-round", code: 42 },
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  const terminal = apply(won, {
    type: "submit-hint-answer",
    roundId: challenge.roundId,
    challengeId: challenge.challengeId,
    answer: challenge.expectedAnswer,
  });

  for (const state of [
    malformed,
    wrong,
    revealed,
    abandoned,
    stale,
    activeGuess,
    terminal,
  ]) {
    assert.deepEqual(
      selectEarnedHintReadModel(state).facts,
      publicBefore.facts,
      "only a current correct answer may publish a fact",
    );
    assert.equal(selectEarnedHintReadModel(state).latestAwardedFactId, null);
  }
  assert.deepEqual(
    activeGuess.attempts,
    opened.attempts,
    "guess submission is guarded while a challenge is active",
  );
});

test("SC04 round: reset is atomic even for a repeated code, while terminal public facts remain readable", () => {
  const initial = createSafeGameState(42);
  const awarded = answerActiveChallenge(openChallenge(initial));
  const won = apply(
    awarded,
    { type: "set-input", input: "42" },
    { type: "submit-guess" },
  );
  const terminalModel = selectEarnedHintReadModel(won);
  assert.equal(
    terminalModel.facts.length,
    1,
    "terminal states retain earned facts",
  );

  const reset = apply(won, { type: "new-round", code: 42 });
  const resetModel = selectEarnedHintReadModel(reset);
  assert.equal(
    reset.roundId,
    initial.roundId + 1,
    "same-code restart still advances the public round identity",
  );
  assert.deepEqual(resetModel.facts, []);
  assert.equal(resetModel.latestAwardedFactId, null);
  assert.equal(reset.hintChallenge, null);
});
