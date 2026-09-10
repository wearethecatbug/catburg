export const SAFE_CODE_MINIMUM = 1;
export const SAFE_CODE_MAXIMUM = 1000;

export type SafeGamePhase = "playing" | "won" | "surrendered";
export type SafeGameFeedback = "none" | "invalid" | "wrong" | "won" | "surrendered";
export type CatReaction = "idle" | "wrong" | "won" | "surrendered" | "hover";
export type SafeHint = "even" | "odd";
export type HintOperator = "+" | "-" | "×" | "÷";

export interface HintChallenge {
  // Both identities travel with answers so a replaced question cannot accept stale work.
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
  // A revealed arithmetic answer abandons this question and cannot earn a safe hint.
  revealedMathAnswer: number | null;
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
