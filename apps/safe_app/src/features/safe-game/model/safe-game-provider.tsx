"use client";

import type { ReactNode } from "react";
import type { RoundSource } from "../domain";
import { SafeGameContext } from "./safe-game-context";
import { useGameController } from "./use-game-controller";

export function SafeGameProvider({
  children,
  roundSource,
}: {
  children: ReactNode;
  roundSource?: RoundSource;
}) {
  const controller = useGameController(roundSource);
  return (
    <SafeGameContext.Provider value={controller}>
      {children}
    </SafeGameContext.Provider>
  );
}
