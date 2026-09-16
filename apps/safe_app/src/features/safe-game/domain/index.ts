export { createSafeGameState, generateSafeCode } from "./game.factory";
export { defaultRoundSource, type RoundSource } from "./round-source";
export { reduceSafeGame } from "./game.reducer";
export { normalizeSafeGuess } from "./guess";
export { createHintChallenge, hasChallengeId } from "./math-challenge";
export {
  buildPublicCandidateCodes,
  chooseNextHintPredicate,
  evaluateEarnedHintFact,
  filterCandidateCodesByFact,
} from "./earned-hint-facts";
export { SAFE_CODE_MAXIMUM, SAFE_CODE_MINIMUM } from "./game.types";
export type {
  HintChallenge,
  HintOperator,
  SafeGameAction,
  SafeGameFeedback,
  SafeGamePhase,
  SafeGameState,
  SafeHint,
} from "./game.types";
export type {
  EarnedHintFact,
  HintPredicate,
  PublicHintKnowledge,
} from "./earned-hint-facts";
