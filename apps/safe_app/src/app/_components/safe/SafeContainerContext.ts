import React, { createContext } from "react";
import type { SafeAction, SafeState } from "@/components/safe/SafeContainerReducer";

export type SafeContainerContextType = {
    state: SafeState, dispatch: React.Dispatch<SafeAction>;
}

const SafeContainerContext = createContext<SafeContainerContextType | null>(null);

export function useSafeContext() {
  const context = React.useContext(SafeContainerContext);
  if (!context) {
    throw new Error("Safe game controls must be used inside SafeContainer.");
  }
  return context;
}

export default SafeContainerContext;
