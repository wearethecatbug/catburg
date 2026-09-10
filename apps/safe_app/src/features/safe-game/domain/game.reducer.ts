import { createSafeGameState } from "./game.factory";
import { normalizeSafeGuess } from "./guess";
import { hasChallengeId } from "./math-challenge";
import type { SafeGameAction, SafeGameState, SafeHint } from "./game.types";

function hintForCode(code: number): SafeHint {
  return code % 2 === 0 ? "even" : "odd";
}

export function reduceSafeGame(state: SafeGameState, action: SafeGameAction): SafeGameState {
  if (action.type === "new-round") {
    // Advance identity even when randomness selects the same code again.
    return { ...createSafeGameState(action.code), roundId: state.roundId + 1 };
  }

  if (action.type === "toggle-history") {
    return { ...state, historyVisible: !state.historyVisible };
  }

  if (action.type === "close-hint-challenge") {
    return action.roundId === state.roundId && state.hintChallenge && hasChallengeId(action.challengeId) && action.challengeId === state.hintChallenge.challengeId
      ? { ...state, hintChallenge: null, hintFeedback: "none", revealedMathAnswer: null }
      : state;
  }

  if (state.phase !== "playing") {
    return state;
  }

  switch (action.type) {
    case "show-hint":
      // Earning and displaying are separate: the next hint request repeats the earned fact.
      if (state.earnedHint) return { ...state, shownHint: state.earnedHint };
      if (state.hintChallenge || action.challenge.roundId !== state.roundId || !hasChallengeId(action.challenge.challengeId)) return state;
      return { ...state, hintChallenge: action.challenge, hintFeedback: "none", revealedMathAnswer: null, shownHint: null };
    case "replace-hint-challenge":
      if (!state.hintChallenge || state.earnedHint || action.roundId !== state.roundId || !hasChallengeId(action.challengeId) || action.challengeId !== state.hintChallenge.challengeId || action.challenge.roundId !== state.roundId || !hasChallengeId(action.challenge.challengeId)) return state;
      if (action.challenge.challengeId === state.hintChallenge.challengeId) return state;
      return { ...state, hintChallenge: action.challenge, hintFeedback: "none", revealedMathAnswer: null, shownHint: null };
    case "give-up-hint-challenge":
      if (!state.hintChallenge || action.roundId !== state.roundId || !hasChallengeId(action.challengeId) || action.challengeId !== state.hintChallenge.challengeId) return state;
      return { ...state, hintFeedback: "none", revealedMathAnswer: state.hintChallenge.expectedAnswer };
    case "submit-hint-answer": {
      const challenge = state.hintChallenge;
      if (!challenge || action.roundId !== state.roundId || !hasChallengeId(action.challengeId) || action.challengeId !== challenge.challengeId || challenge.roundId !== action.roundId) return state;
      if (state.revealedMathAnswer !== null) return state;
      if (action.answer !== challenge.expectedAnswer) return { ...state, hintFeedback: "try-again" };
      return { ...state, hintChallenge: null, hintFeedback: "none", revealedMathAnswer: null, earnedHint: hintForCode(state.code), shownHint: null };
    }
    case "set-input":
      return { ...state, input: action.input };
    case "set-cat-hover":
      return { ...state, catReaction: action.active ? "hover" : "idle" };
    case "surrender":
      return { ...state, phase: "surrendered", feedback: "surrendered", catReaction: "surrendered", revealedCode: state.code, hintChallenge: null, hintFeedback: "none", revealedMathAnswer: null };
    case "submit-guess": {
      const normalizedGuess = normalizeSafeGuess(state.input);
      if (!normalizedGuess.valid) return { ...state, feedback: "invalid" };
      const attempts = state.attempts.includes(normalizedGuess.value) ? state.attempts : [...state.attempts, normalizedGuess.value];
      if (normalizedGuess.value === state.code) {
        return { ...state, attempts, phase: "won", feedback: "won", safeOpen: true, catReaction: "won", hintChallenge: null, hintFeedback: "none", revealedMathAnswer: null };
      }
      return { ...state, attempts, feedback: "wrong", catReaction: "wrong" };
    }
  }
}
