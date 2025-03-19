'use client'

import styles from './SafeContainer.module.css';
import SafeComponent from "@/app/_components/SafeComponent";
import LogView from "@/app/_components/LogView";
import React, { useEffect, useRef, useState, useReducer } from "react";
import SafeCodeInput from "@/app/_components/SafeCodeInput";
import HintPopupView from "@/app/_components/HintPopupView";
import Menu, {MenuConfiguration} from "@/app/_components/Menu";
import { QuestionProvider } from "@/app/_components/HintPopupView";
import { SignsProvider, useSigns } from "@/app/_components/SignsMenuButtons";
import SafeSettings from "./SettingButtonView.tsx";
import CatView, {initialCatViewState} from "./CatView";


enum MenuButtons {
    ON_NEW_GAME = 'onNewGame',
    ON_GIVE_UP = 'onGiveUp',
    ON_SHOW_HINT = 'onShowHint',
    ON_SHOW_LOG = 'onShowLog',
}

// Определяем начальное состояние
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

// Определяем возможные действия (action)
export type SafeAction =
    | { type: 'NEW_GAME'; payload: number }
    | { type: 'SET_WIN'; payload: boolean }
    | { type: 'SET_WRONG_SAFE_CODE'; payload: boolean }
    | { type: 'SET_DISABLED'; payload: boolean }
    | { type: 'TOGGLE_HINT' }
    | { type: 'TOGGLE_LOG' }
    | { type: 'ADD_LOG'; payload: string }
    | { type: 'CLEAR_LOGS' }
    | { type: 'SET_GIVE_UP'; payload: boolean }
    | { type: 'SET_INPUT_VALUE'; payload: string }
    | { type:"TOGGLE_SAFE";   payload: boolean }

// Начальное состояние
const initialState: SafeState = {
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

function safeReducer(state: SafeState, action: SafeAction): SafeState {
    switch (action.type) {
        case 'NEW_GAME':
            return { ...initialState, safeCode: action.payload };
        case 'SET_WIN':
            return { ...state, isWin: action.payload, isDisabled: action.payload };
        case 'SET_WRONG_SAFE_CODE':
            return { ...state, isWrongSafeCode: action.payload };
        case 'SET_DISABLED':
            return { ...state, isDisabled: action.payload };
        case 'TOGGLE_HINT':
            return { ...state, isHintVisible: !state.isHintVisible };
        case 'TOGGLE_LOG':
            return { ...state, isLogVisible: !state.isLogVisible };
        case 'ADD_LOG':
            return { ...state, logs: Array.from(new Set([...state.logs, action.payload])) };
        case 'CLEAR_LOGS':
            return { ...state, logs: [], isLogVisible: false };
        case 'SET_GIVE_UP':
            return { ...state, isGiveUp: action.payload };
        case 'SET_INPUT_VALUE':
            return { ...state, inputValue: action.payload };
        case "TOGGLE_SAFE":
            return { ...state, safeOpen:  action.payload  };
        default:
            return state;
    }
}

const menuConfiguration: MenuConfiguration = {
    buttons: [
        {id: MenuButtons.ON_NEW_GAME, name: 'new game', className: styles.newGame},
        {id: MenuButtons.ON_GIVE_UP, name: 'give up', className: styles.giveUp},
        {id: MenuButtons.ON_SHOW_HINT, name: 'show hint', className: styles.hint},
        {id: MenuButtons.ON_SHOW_LOG, name: 'show log', className: styles.log},
    ],
    style: styles.menuButton,
}

export default function SafeContainer() {
    const safeCodeInputRef = useRef<HTMLInputElement | null>(null);
    const [isSafeComponentInitialized, setSafeComponentInitialized] = useState(false)
    const [state, dispatch] = useReducer(safeReducer, initialState);
    const logViewRef = useRef<HTMLInputElement | null>(null);
    const [currentSkinCatViewState, setCurrentSkinCatViewState] = useState<keyof typeof initialCatViewState>("defaultState");
    const [isGiveUpHintActive, setIsGiveUpHintActive] = useState(false);
    const [safeCode, setSafeCode] = useState<number>(0)
    const [firstNumberCodeRange, setFirstNumberCodeRange] = useState<number>(1);
    const [secondNumberCodeRange, setSecondNumberCodeRange] = useState<number>(1000);
    const [firstNumberHintRange, setFirstNumberHintRange] = useState(1);
    const [secondNumberHintRange, setSecondNumberHintRange] = useState(1000);

    useEffect(() => {
            setSafeComponentInitialized(true);
    }, []);

    useEffect(() => {
        console.log('Новое состояние кота:', currentSkinCatViewState);
    }, [currentSkinCatViewState]);

    const updateCatViewState = (newState: keyof typeof initialCatViewState)  => {
        console.log('gau'+ initialCatViewState[newState]);
        setCurrentSkinCatViewState(newState);
    };


    function handleMouseEnter() {
        updateCatViewState("petpet");
    }

    function handleMouseLeave() {
        setTimeout(() => {
            if (isGiveUpHintActive) {
                updateCatViewState('hintPopupContainerGiveUp');
            } else if (state.isHintVisible){
                updateCatViewState('hintPopupViewOpen');
            } else {
                updateCatViewState('defaultState');
            }
        }, 1000);
    }

    function onMenuButtonClick(id: string) {
        switch ( id ) {
            case MenuButtons.ON_NEW_GAME:
                onNewGame();
                break;
            case MenuButtons.ON_GIVE_UP:
                onGiveUp();
                break;
            case MenuButtons.ON_SHOW_HINT:
                onShowHint();
                break;
            case MenuButtons.ON_SHOW_LOG:
                onShowLog();
                break;
            default: console.log('Unknown button clicked');
                break;
        }
    }


    function onShowLog() {
        dispatch({ type: 'TOGGLE_LOG' });
    }

    function generateSafeCode(firstNumberCodeRange, secondNumberCodeRange) {
        return  setSafeCode(Math.floor(Math.random() * secondNumberCodeRange) + firstNumberCodeRange) ;
    }

    function onNewGame() {
        generateSafeCode(firstNumberCodeRange, secondNumberCodeRange) ;
        dispatch({ type: 'NEW_GAME', payload: safeCode });
        dispatch({ type: 'TOGGLE_SAFE', payload: false});
        safeCodeInputRef.current.focus();
        updateCatViewState('defaultState');
        // console.log("New game started with code:", newCode);
        console.log("New game started with code:",safeCode);
    }


    function onGameStart() {
        onNewGame();
    }

    useEffect(() => {
        onGameStart()
    }, []);

    function onGiveUp() {
        dispatch({ type: 'SET_DISABLED', payload: true });
        dispatch({ type: 'SET_GIVE_UP', payload: true });

        updateCatViewState("giveUpGame");
        console.log('Newсостояни'+ currentSkinCatViewState)
    }

    useEffect(() => {
        if (state.isGiveUp && state.safeCode !== null) {
            dispatch({ type: 'SET_INPUT_VALUE', payload: String(state.safeCode) });
        }
    }, [state.isGiveUp, state.safeCode]);

    useEffect(() => {
        if (state.safeOpen && safeCodeInputRef.current) {
            safeCodeInputRef.current.focus();
        }
    }, [state.safeOpen]);

    function onShowHint() {
        dispatch({ type: 'TOGGLE_HINT' });

    }

    useEffect(() => {
        if (state.isHintVisible) {
            console.log("Подсказка открыта, меняем состояние кота");
            updateCatViewState("hintPopupViewOpen");
        } else if (!state.isHintVisible){
            console.log("Подсказка закрыта, возвращаем дефолтный скин");
            setIsGiveUpHintActive(false);
            updateCatViewState("defaultState");
        }
        if (isGiveUpHintActive && state.isHintVisible) {
            console.log("Игрок сдался, меняем состояние кота");
            updateCatViewState("hintPopupContainerGiveUp");
        }

    }, [state.isHintVisible, isGiveUpHintActive]); // useEffect срабатывает при изменении isHintVisible


    const getButtonClass = (id: string) => {
        if ((id === MenuButtons.ON_GIVE_UP || id === MenuButtons.ON_SHOW_HINT) &&  (state.isGiveUp || state.isWin)) {
            return styles.disabledButton;
        }
        if (id === MenuButtons.ON_NEW_GAME && (state.isGiveUp || state.isWin)) {
            return styles.newGameAfterGiveUp;
        }
        return "";
    };

    function onUserWin() {
        dispatch({ type: 'TOGGLE_SAFE', payload: true});
        dispatch({ type: 'SET_WIN', payload: true });
        dispatch({ type: 'SET_DISABLED', payload: true });
        updateCatViewState("userWin");

    }

    function onOkButtonClick() {
        if (state.safeCode === null || state.inputValue.trim() === "") return;

        if (state.inputValue === String(state.safeCode)) {
            onUserWin();
        } else {
            dispatch({ type: 'SET_WRONG_SAFE_CODE', payload: true });
        }
        onAddLogAction();
    }

    function onAddLogAction() {
        dispatch({ type: 'ADD_LOG', payload: state.inputValue});
    }


    return <div>

        <div className={styles.safeContainer}>
            <p className={styles.headerText}>The safe code is a number that ranges from 1 to 1000</p>
                <SafeSettings inputCodeRangeNumbers={{ firstNumberCodeRange, setFirstNumberCodeRange,secondNumberCodeRange,setSecondNumberCodeRange}} inputHintRangeNumbers={{firstNumberHintRange, setFirstNumberHintRange, secondNumberHintRange, setSecondNumberHintRange}} ></SafeSettings>

            <div className={styles.safeAndMenuContainer}>

                <div>
                    <SafeComponent safeOpen={state.safeOpen} isSafeComponentInitialized={isSafeComponentInitialized}  />
                    <CatView   currentSkinCatViewState={currentSkinCatViewState}  isSafeComponentInitialized={isSafeComponentInitialized} updateCatViewState={updateCatViewState}  onMouseEnter={handleMouseEnter}
                               onMouseLeave={handleMouseLeave}/>
                    <div className={styles.SafeCodeInputContainer}>
                        <SafeCodeInput ref={safeCodeInputRef} state={state} dispatch={dispatch} onOkButtonClick={onOkButtonClick} />
                        <SignsProvider>
                            <QuestionProvider firstNumberHintRange={firstNumberHintRange} secondNumberHintRange={secondNumberHintRange}>

                                {state.isHintVisible && (
                                    <HintPopupView  onCloseHintAction={() => dispatch({ type: 'TOGGLE_HINT' })} safeCodeInputRef={safeCodeInputRef}  getButtonClass={getButtonClass}
                                                    onGiveUpHintChange={setIsGiveUpHintActive} firstNumberHintRange={firstNumberHintRange}
                                                    setFirstNumberHintRange={setFirstNumberHintRange}
                                                    secondNumberHintRange={secondNumberHintRange}
                                                    setSecondNumberHintRange={setSecondNumberHintRange} />
                                )}
                            </QuestionProvider>
                        </SignsProvider>
                    </div>

                </div>
                <Menu getButtonClass={getButtonClass} menuConfiguration={menuConfiguration} onMenuButtonClickAction={onMenuButtonClick}  state={state} ref={safeCodeInputRef} />

            </div>
            <div className={styles.logWrapper}>
                {state.isLogVisible && <LogView ref={logViewRef} logs={state.logs} />}

            </div>

        </div>

    </div>

}