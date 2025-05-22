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

type safeAction = keyof typeof SAFE_ACTION;
//
// type SafeActions =
//     | { type: typeof SAFE_ACTION.NEW_GAME; payload: string } // safeCode
//     | { type: typeof SAFE_ACTION.SET_WIN; payload: boolean }
//     | { type: typeof SAFE_ACTION.SET_WRONG_SAFE_CODE; payload: boolean }
//     | { type: typeof SAFE_ACTION.SET_DISABLED; payload: boolean }
//     | { type: typeof SAFE_ACTION.TOGGLE_HINT }
//     | { type: typeof SAFE_ACTION.TOGGLE_LOG }
//     | { type: typeof SAFE_ACTION.ADD_LOG; payload: string }
//     | { type: typeof SAFE_ACTION.CLEAR_LOGS }
//     | { type: typeof SAFE_ACTION.SET_GIVE_UP; payload: boolean }
//     | { type: typeof SAFE_ACTION.SET_INPUT_VALUE; payload: string }
//     | { type: typeof SAFE_ACTION.TOGGLE_SAFE; payload: boolean }; // описание типов пейлоад

export interface SafeAction {
    type: safeAction;
    payload?: any; //TODO рефакторинг типа
}
export function getSafeInitialStage(): SafeState {
    // Начальное состояние
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