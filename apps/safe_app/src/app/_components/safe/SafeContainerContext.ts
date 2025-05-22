import React, {createContext} from 'react';
import {SafeState} from "@/app/_components/safeContainer/SafeContainerReducer";

export type SafeContainerContextType = {
    state: SafeState, dispatch: React.Dispatch<any>;
}

const SafeContainerContext = createContext({} as SafeContainerContextType);

export function useSafeContext() {
    return React.useContext(SafeContainerContext);
}

export default SafeContainerContext;