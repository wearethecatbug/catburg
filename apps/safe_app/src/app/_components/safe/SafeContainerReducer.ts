import { useReducer } from "react";
import { createSafeGameState, generateSafeCode, reduceSafeGame } from "@/domain/safe-game";
import type { SafeGameAction, SafeGameState } from "@/domain/safe-game";

export type SafeState = SafeGameState;
export type SafeAction = SafeGameAction;
export const safeReducer = reduceSafeGame;

export function getSafeInitialStage(): SafeState {
  return createSafeGameState(generateSafeCode());
}

export const useSafeReducer = () => useReducer(safeReducer, undefined, getSafeInitialStage);
