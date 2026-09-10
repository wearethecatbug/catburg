import { createContext, useContext } from "react";
import type { useGameController } from "./use-game-controller";

export type SafeGameContextValue = ReturnType<typeof useGameController>;

export const SafeGameContext = createContext<SafeGameContextValue | null>(null);

export function useSafeGameContext() {
  const context = useContext(SafeGameContext);
  if (!context) throw new Error("Safe game controls must be used inside SafeGameProvider.");
  return context;
}
