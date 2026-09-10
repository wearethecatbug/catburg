export const SAFE_CODE_MINIMUM = 1;
export const SAFE_CODE_MAXIMUM = 1000;

export type SafeGamePhase = "playing" | "won" | "surrendered";
export type SafeGameFeedback = "none" | "invalid" | "wrong" | "won" | "surrendered";
export type CatReaction = "idle" | "wrong" | "won" | "surrendered" | "hover";
export type SafeHint = "The code is even." | "The code is odd.";
export type HintOperator = "+" | "-" | "×" | "÷";

export interface HintChallenge {
  roundId: number;
  challengeId: string;
  operator: HintOperator;
  leftOperand: number;
  rightOperand: number;
  expectedAnswer: number;
}

export interface SafeGameState {
  code: number;
  roundId: number;
  phase: SafeGamePhase;
  input: string;
  feedback: SafeGameFeedback;
  safeOpen: boolean;
  catReaction: CatReaction;
  revealedCode: number | null;
  attempts: number[];
  historyVisible: boolean;
  hintChallenge: HintChallenge | null;
  hintFeedback: "none" | "try-again";
  revealedMathAnswer?: number | null;
  earnedHint: SafeHint | null;
  shownHint: SafeHint | null;
}

export type SafeGameAction =
  | { type: "new-round"; code: number }
  | { type: "set-input"; input: string }
  | { type: "submit-guess" }
  | { type: "surrender" }
  | { type: "toggle-history" }
  | { type: "show-hint"; challenge: HintChallenge }
  | { type: "replace-hint-challenge"; roundId: number; challengeId: string; challenge: HintChallenge }
  | { type: "give-up-hint-challenge"; roundId: number; challengeId: string }
  | { type: "submit-hint-answer"; roundId: number; challengeId: string; answer: number | null }
  | { type: "close-hint-challenge"; roundId: number; challengeId: string }
  | { type: "set-cat-hover"; active: boolean };

export function generateSafeCode(
  random: () => number = Math.random,
  minimum = SAFE_CODE_MINIMUM,
  maximum = SAFE_CODE_MAXIMUM,
) {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 1 || maximum < minimum) {
    throw new RangeError("Safe code bounds must be positive ordered integers.");
  }

  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

export function normalizeSafeGuess(input: string): { valid: true; value: number } | { valid: false } {
  // Preserve the public input contract: whitespace and leading zeroes normalize, but numeric notation does not.
  const trimmedInput = input.trim();
  if (!/^\d+$/.test(trimmedInput)) {
    return { valid: false };
  }

  const value = Number(trimmedInput);
  return Number.isSafeInteger(value) && value >= SAFE_CODE_MINIMUM && value <= SAFE_CODE_MAXIMUM
    ? { valid: true, value }
    : { valid: false };
}

/** Creates a round-bound math question so callers can control randomness without sharing game state. */
function hasChallengeId(challengeId: unknown): challengeId is string {
  return typeof challengeId === "string" && challengeId.trim().length > 0;
}

export function createHintChallenge(random: () => number, roundId: number, operator: HintOperator, challengeId: string): HintChallenge {
  if (!hasChallengeId(challengeId)) {
    throw new RangeError("Hint challenge identity must be a non-empty string.");
  }
  const createOperand = () => 1 + Math.floor(random() * 10);
  const firstOperand = createOperand();
  const secondOperand = createOperand();

  let leftOperand = firstOperand;
  let rightOperand = secondOperand;
  let expectedAnswer = firstOperand + secondOperand;
  if (operator === "-") {
    leftOperand = Math.max(firstOperand, secondOperand);
    rightOperand = Math.min(firstOperand, secondOperand);
    expectedAnswer = leftOperand - rightOperand;
  } else if (operator === "×") {
    expectedAnswer = firstOperand * secondOperand;
  } else if (operator === "÷") {
    leftOperand = firstOperand * secondOperand;
    expectedAnswer = firstOperand;
  }
  return { roundId, challengeId, operator, leftOperand, rightOperand, expectedAnswer };
}

function hintForCode(code: number): SafeHint {
  return code % 2 === 0 ? "The code is even." : "The code is odd.";
}

export function createSafeGameState(code: number): SafeGameState {
  if (!Number.isInteger(code) || code < SAFE_CODE_MINIMUM || code > SAFE_CODE_MAXIMUM) {
    throw new RangeError("Safe code must be an integer in the advertised range.");
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
  };
}

export function reduceSafeGame(state: SafeGameState, action: SafeGameAction): SafeGameState {
  if (action.type === "new-round") {
    // Rebuilding the state prevents an earned or pending hint from crossing into the next round.
    const nextRound = { ...createSafeGameState(action.code), roundId: state.roundId + 1 };
    if ("revealedMathAnswer" in state) return nextRound;
    const legacyCompatibleRound = { ...nextRound };
    delete legacyCompatibleRound.revealedMathAnswer;
    return legacyCompatibleRound;
  }

  if (action.type === "toggle-history") {
    return { ...state, historyVisible: !state.historyVisible };
  }

  if (action.type === "close-hint-challenge") {
    // A close signal from an older dialog must not affect the active round.
    return action.roundId === state.roundId && state.hintChallenge && hasChallengeId(action.challengeId) && action.challengeId === state.hintChallenge.challengeId
      ? { ...state, hintChallenge: null, hintFeedback: "none" }
      : state;
  }

  if (state.phase !== "playing") {
    // A completed round permits history viewing and an explicit new round, but no game-changing actions.
    return state;
  }

  switch (action.type) {
    case "show-hint":
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
      return {
        ...state,
        hintChallenge: null,
        hintFeedback: "none",
        revealedMathAnswer: null,
        earnedHint: hintForCode(state.code),
        shownHint: null,
      };
    }
    case "set-input":
      return { ...state, input: action.input };
    case "set-cat-hover":
      return { ...state, catReaction: action.active ? "hover" : "idle" };
    case "surrender":
      {
        const terminalState = { ...state };
        delete terminalState.revealedMathAnswer;
      return {
        ...terminalState,
        phase: "surrendered",
        feedback: "surrendered",
        catReaction: "surrendered",
        revealedCode: state.code,
      };
      }
    case "submit-guess": {
      const normalizedGuess = normalizeSafeGuess(state.input);
      if (!normalizedGuess.valid) {
        return { ...state, feedback: "invalid" };
      }

      const attempts = state.attempts.includes(normalizedGuess.value)
        ? state.attempts
        : [...state.attempts, normalizedGuess.value];
      if (normalizedGuess.value === state.code) {
        const terminalState = { ...state };
        delete terminalState.revealedMathAnswer;
        return {
          ...terminalState,
          attempts,
          phase: "won",
          feedback: "won",
          safeOpen: true,
          catReaction: "won",
        };
      }

      return { ...state, attempts, feedback: "wrong", catReaction: "wrong" };
    }
  }
}
