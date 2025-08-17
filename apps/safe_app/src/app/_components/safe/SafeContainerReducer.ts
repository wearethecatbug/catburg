import {useReducer} from "react";

export interface SafeState {
    safeCode: number | null;
    isWin: boolean;
    isWrongSafeCode: boolean;
    isDisabled: boolean;
    isNewGame: boolean;
    isGiveUp: boolean;
    isHintVisible: boolean;
    isLogVisible: boolean;
    logs: string[];
    inputValue: string,
    safeOpen: boolean;
}

export const SAFE_ACTION = {
    NEW_GAME: 'NEW_GAME',
    SET_WIN: 'SET_WIN',
    SET_WRONG_SAFE_CODE: 'SET_WRONG_SAFE_CODE',
    SET_DISABLED: 'SET_DISABLED',
    TOGGLE_HINT: 'TOGGLE_HINT',
    TOGGLE_LOG: 'TOGGLE_LOG',
    ADD_LOG: 'ADD_LOG',
    CLEAR_LOGS: 'CLEAR_LOGS',
    SET_GIVE_UP: 'SET_GIVE_UP',
    SET_INPUT_VALUE: 'SET_INPUT_VALUE',
    TOGGLE_SAFE: "TOGGLE_SAFE",
    ON_USER_WIN: "ON_USER_WIN",
} as const;

type SafeActionType = keyof typeof SAFE_ACTION;

type SafeActionPayloads = {
    [SAFE_ACTION.NEW_GAME]: number;
    [SAFE_ACTION.SET_WIN]: boolean;
    [SAFE_ACTION.SET_WRONG_SAFE_CODE]: boolean;
    [SAFE_ACTION.SET_DISABLED]: boolean;
    [SAFE_ACTION.TOGGLE_HINT]: undefined;
    [SAFE_ACTION.TOGGLE_LOG]: undefined;
    [SAFE_ACTION.ADD_LOG]: string;
    [SAFE_ACTION.CLEAR_LOGS]: undefined;
    [SAFE_ACTION.SET_GIVE_UP]: boolean;
    [SAFE_ACTION.SET_INPUT_VALUE]: string;
    [SAFE_ACTION.TOGGLE_SAFE]: boolean;
    [SAFE_ACTION.ON_USER_WIN]: boolean;
};

export type SafeAction = {
    [K in SafeActionType]: SafeActionPayloads[K] extends undefined
        ? { type: K }
        : { type: K; payload: SafeActionPayloads[K] }
}[SafeActionType];
export function getSafeInitialStage(): SafeState {
    // Initial state
    return {
        safeCode: null,
        isWin: false,
        isWrongSafeCode: false,
        isDisabled: false,
        isNewGame: true,
        isGiveUp: false,
        isHintVisible: false,
        isLogVisible: false,
        logs: [],
        inputValue: "",
        safeOpen: false,
    };
}

export function safeReducer(state: SafeState, action: SafeAction): SafeState {
    switch (action.type) {
        case SAFE_ACTION.NEW_GAME:
            return { ...getSafeInitialStage(), safeCode: action.payload };
        case SAFE_ACTION.SET_WIN:
            return { ...state, isWin: action.payload, isDisabled: action.payload };
        case SAFE_ACTION.SET_WRONG_SAFE_CODE:
            return { ...state, isWrongSafeCode: action.payload };
        case SAFE_ACTION.SET_DISABLED:
            return { ...state, isDisabled: action.payload };
        case SAFE_ACTION.TOGGLE_HINT:
            return { ...state, isHintVisible: !state.isHintVisible };
        case SAFE_ACTION.TOGGLE_LOG:
            return { ...state, isLogVisible: !state.isLogVisible };
        case SAFE_ACTION.ADD_LOG:
            return { ...state, logs: Array.from(new Set([...state.logs, action.payload])) };
        case SAFE_ACTION.CLEAR_LOGS:
            return { ...state, logs: [], isLogVisible: false };
        case SAFE_ACTION.SET_GIVE_UP:
            return { ...state, isGiveUp: action.payload };
        case SAFE_ACTION.SET_INPUT_VALUE:
            return { ...state, inputValue: action.payload };
        case SAFE_ACTION.TOGGLE_SAFE:
            return { ...state, safeOpen:  action.payload };
        case SAFE_ACTION.ON_USER_WIN:
            return { ...state, isWin: action.payload,  isDisabled: action.payload, safeOpen: action.payload  };
        default:
            return state;
    }
}

export const useSafeReducer = () => {
    const [state, dispatch] = useReducer(safeReducer, getSafeInitialStage());

    return [ state, dispatch ] as const;
}