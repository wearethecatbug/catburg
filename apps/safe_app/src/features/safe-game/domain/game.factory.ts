import { SAFE_CODE_MAXIMUM, SAFE_CODE_MINIMUM } from "./game.types";
import type { SafeGameState } from "./game.types";

/** The supplied random source returns values in [0, 1); both integer bounds are inclusive. */
export function generateSafeCode(
  random: () => number,
  minimum = SAFE_CODE_MINIMUM,
  maximum = SAFE_CODE_MAXIMUM,
) {
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    minimum < 1 ||
    maximum < minimum
  ) {
    throw new RangeError("Safe code bounds must be positive ordered integers.");
  }

  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

/** Every round starts with the same keys; absent challenge-scoped values are explicitly null. */
export function createSafeGameState(code: number): SafeGameState {
  if (
    !Number.isInteger(code) ||
    code < SAFE_CODE_MINIMUM ||
    code > SAFE_CODE_MAXIMUM
  ) {
    throw new RangeError(
      "Safe code must be an integer in the advertised range.",
    );
  }

  return {
    code,
    roundId: 1,
    phase: "playing",
    input: "",
    feedback: "none",
    safeOpen: false,
    catReaction: "idle",
    revealedCode: null,
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
  };
}
