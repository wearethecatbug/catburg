export const SAFE_CODE_MINIMUM = 1;
export const SAFE_CODE_MAXIMUM = 1000;

export type SafeGamePhase = "playing" | "won" | "surrendered";
export type SafeGameFeedback = "none" | "invalid" | "wrong" | "won" | "surrendered";
export type CatReaction = "idle" | "wrong" | "won" | "surrendered" | "hover";

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
}

export type SafeGameAction =
  | { type: "new-round"; code: number }
  | { type: "set-input"; input: string }
  | { type: "submit-guess" }
  | { type: "surrender" }
  | { type: "toggle-history" }
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
  };
}

export function reduceSafeGame(state: SafeGameState, action: SafeGameAction): SafeGameState {
  if (action.type === "new-round") {
    return { ...createSafeGameState(action.code), roundId: state.roundId + 1 };
  }

  if (action.type === "toggle-history") {
    return { ...state, historyVisible: !state.historyVisible };
  }

  if (state.phase !== "playing") {
    // A completed round permits history viewing and an explicit new round, but no game-changing actions.
    return state;
  }

  switch (action.type) {
    case "set-input":
      return { ...state, input: action.input };
    case "set-cat-hover":
      return { ...state, catReaction: action.active ? "hover" : "idle" };
    case "surrender":
      return {
        ...state,
        phase: "surrendered",
        feedback: "surrendered",
        catReaction: "surrendered",
        revealedCode: state.code,
      };
    case "submit-guess": {
      const normalizedGuess = normalizeSafeGuess(state.input);
      if (!normalizedGuess.valid) {
        return { ...state, feedback: "invalid" };
      }

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
        };
      }

      return { ...state, attempts, feedback: "wrong", catReaction: "wrong" };
    }
  }
}
