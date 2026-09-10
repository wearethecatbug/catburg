import React, {createContext} from 'react';
import type {SafeAction, SafeState} from "@/components/safe/SafeContainerReducer";

export type SafeContainerContextType = {
    state: SafeState, dispatch: React.Dispatch<SafeAction>;
}

const SafeContainerContext = createContext({} as SafeContainerContextType);

export function useSafeContext() {
    return React.useContext(SafeContainerContext);
}

export default SafeContainerContext;
