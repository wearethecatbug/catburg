import { createSafeGameState } from "./game.factory";
import { normalizeSafeGuess } from "./guess";
import { hasChallengeId, isValidHintChallenge } from "./math-challenge";
import {
  buildPublicCandidateCodes,
  chooseNextHintPredicate,
  evaluateEarnedHintFact,
} from "./earned-hint-facts";
import type { SafeGameAction, SafeGameState, SafeHint } from "./game.types";

function hintForCode(code: number): SafeHint {
  return code % 2 === 0 ? "even" : "odd";
}

export function reduceSafeGame(
  state: SafeGameState,
  action: SafeGameAction,
): SafeGameState {
  if (action.type === "new-round") {
    // Advance identity even when randomness selects the same code again.
    return { ...createSafeGameState(action.code), roundId: state.roundId + 1 };
  }

  if (action.type === "toggle-history") {
    return { ...state, historyVisible: !state.historyVisible };
  }

  if (action.type === "close-hint-challenge") {
    return action.roundId === state.roundId &&
      state.hintChallenge &&
      hasChallengeId(action.challengeId) &&
      action.challengeId === state.hintChallenge.challengeId
      ? {
          ...state,
          hintChallenge: null,
          activeHintPredicateId: null,
          hintFeedback: "none",
          revealedMathAnswer: null,
        }
      : state;
  }

  if (state.phase !== "playing") {
    return state;
  }

  switch (action.type) {
    case "show-hint":
      if (
        state.hintChallenge ||
        !isValidHintChallenge(action.challenge) ||
        action.challenge.roundId !== state.roundId
      )
        return state;
      {
        const predicate = chooseNextHintPredicate({
          facts: state.earnedHintFacts,
          wrongAttempts: state.attempts,
          issuedPredicateIds: state.issuedHintPredicateIds,
        });
        // A caller may construct the math challenge, but cannot substitute a different public
        // predicate.
        if (
          !predicate ||
          (action.predicateId !== undefined &&
            action.predicateId !== predicate.id)
        )
          return state;
        return {
          ...state,
          hintChallenge: action.challenge,
          activeHintPredicateId: predicate.id,
          hintFeedback: "none",
          revealedMathAnswer: null,
          shownHint: null,
        };
      }
    case "replace-hint-challenge":
      // Replacing a pending predicate could bind an answer to a different public state.
      // Callers must close/discard it and then request a new challenge instead.
      return state;
    case "give-up-hint-challenge":
      if (
        !state.hintChallenge ||
        action.roundId !== state.roundId ||
        !hasChallengeId(action.challengeId) ||
        action.challengeId !== state.hintChallenge.challengeId
      )
        return state;
      return {
        ...state,
        activeHintPredicateId: null,
        hintFeedback: "none",
        revealedMathAnswer: state.hintChallenge.expectedAnswer,
      };
    case "submit-hint-answer": {
      const challenge = state.hintChallenge;
      if (
        !challenge ||
        action.roundId !== state.roundId ||
        !hasChallengeId(action.challengeId) ||
        action.challengeId !== challenge.challengeId ||
        challenge.roundId !== action.roundId
      )
        return state;
      if (state.revealedMathAnswer !== null || !state.activeHintPredicateId)
        return state;
      if (action.answer !== challenge.expectedAnswer)
        return { ...state, hintFeedback: "try-again" };
      {
        const predicate = chooseNextHintPredicate({
          facts: state.earnedHintFacts,
          wrongAttempts: state.attempts,
          issuedPredicateIds: state.issuedHintPredicateIds,
        });
        if (!predicate || predicate.id !== state.activeHintPredicateId)
          return state;
        const publicCandidates = buildPublicCandidateCodes({
          facts: state.earnedHintFacts,
          wrongAttempts: state.attempts,
        });
        const fact = evaluateEarnedHintFact(
          predicate,
          state.code,
          `round:${state.roundId}:fact:${state.earnedHintFacts.length + 1}:${predicate.id}`,
          publicCandidates,
        );
        return {
          ...state,
          hintChallenge: null,
          activeHintPredicateId: null,
          hintFeedback: "none",
          revealedMathAnswer: null,
          earnedHint: hintForCode(state.code),
          shownHint: null,
          earnedHintFacts: [...state.earnedHintFacts, fact],
          issuedHintPredicateIds: [
            ...state.issuedHintPredicateIds,
            predicate.id,
          ],
          latestAwardedFactId: fact.id,
        };
      }
    }
    case "set-input":
      // A real edit clears transient validation feedback and restores the neutral cat reaction.
      if (action.input === state.input) return state;
      return {
        ...state,
        input: action.input,
        feedback:
          state.feedback === "wrong" || state.feedback === "invalid"
            ? "none"
            : state.feedback,
        catReaction: "idle",
      };
    case "set-cat-hover":
      return state.catReaction === "idle" || state.catReaction === "hover"
        ? { ...state, catReaction: action.active ? "hover" : "idle" }
        : state;
    case "surrender":
      return {
        ...state,
        phase: "surrendered",
        feedback: "surrendered",
        catReaction: "surrendered",
        revealedCode: state.code,
        hintChallenge: null,
        activeHintPredicateId: null,
        hintFeedback: "none",
        revealedMathAnswer: null,
      };
    case "submit-guess": {
      if (state.hintChallenge) return state;
      const normalizedGuess = normalizeSafeGuess(state.input);
      if (!normalizedGuess.valid) return { ...state, feedback: "invalid" };
      const attempts = state.attempts.includes(normalizedGuess.value)
        ? state.attempts
        : [...state.attempts, normalizedGuess.value];
      if (normalizedGuess.value === state.code) {
        return {
          ...state,
          attempts,
          phase: "won",
          feedback: "won",
          safeOpen: true,
          catReaction: "won",
          hintChallenge: null,
          activeHintPredicateId: null,
          hintFeedback: "none",
          revealedMathAnswer: null,
        };
      }
      return { ...state, attempts, feedback: "wrong", catReaction: "wrong" };
    }
  }
}
