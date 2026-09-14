"use client";

import type { ReactNode } from "react";
import { SafeGameContext } from "./safe-game-context";
import { useGameController } from "./use-game-controller";

export function SafeGameProvider({ children }: { children: ReactNode }) {
  const controller = useGameController();
  return (
    <SafeGameContext.Provider value={controller}>
      {children}
    </SafeGameContext.Provider>
  );
}
