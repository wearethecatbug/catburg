'use client'

import styles from './SafeContainer.module.css';
import SafeComponent from "@/app/_components/SafeComponent";
import LogView from "@/app/_components/LogView";
import React, { useEffect, useRef, useState } from "react";
import SafeCodeInput from "@/app/_components/SafeCodeInput";
import Menu, {MenuConfiguration} from "@/app/_components/Menu";
import SafeSettings from "@/app/_components/SettingButtonView";
import CatView, {initialCatViewState} from "@/app/_components/CatView";
import {
    SAFE_ACTION,
    useSafeReducer
} from "@/components/safe/SafeContainerReducer";
import SafeContainerContext, {SafeContainerContextType} from "@/components/safe/SafeContainerContext";


enum MenuButtons {
    ON_NEW_GAME = 'onNewGame',
    ON_GIVE_UP = 'onGiveUp',
    ON_SHOW_HINT = 'onShowHint',
    ON_SHOW_LOG = 'onShowLog',
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
    const [state, dispatch] = useSafeReducer();

    const providerState: SafeContainerContextType = { state, dispatch };

    const safeCodeInputRef = useRef<HTMLInputElement | null>(null);
    const [isSafeComponentInitialized, setSafeComponentInitialized] = useState(false)
    const logViewRef = useRef<HTMLInputElement | null>(null);
    const [currentSkinCatViewState, setCurrentSkinCatViewState] = useState<keyof typeof initialCatViewState>("defaultState");
    const [isGiveUpHintActive, setIsGiveUpHintActive] = useState(false);
    const [safeCode, setSafeCode] = useState<number>(0)
    const [firstNumberCodeRange, setFirstNumberCodeRange] = useState<number>(1);
    const [secondNumberCodeRange, setSecondNumberCodeRange] = useState<number>(1000);
    const [firstNumberHintRange, setFirstNumberHintRange] = useState(1);
    const [secondNumberHintRange, setSecondNumberHintRange] = useState(1000);
    const [safeCodeInputFocused, setSafeCodeInputFocused] = useState(true);

    useEffect(() => {
        if (state.isWrongSafeCode) {
            dispatch({ type: SAFE_ACTION.ON_USER_WIN, payload: true}); //TODO: можно объеденить все 3 экшена в один сделать экшен ON_USER_WIN
            updateCatViewState("userWin");
        }
    }, [state.isWin]);

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

    /**
     * Обработчик события mouseEnter для кота.
     */
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
        dispatch({ type: SAFE_ACTION.TOGGLE_LOG });
    }

    function generateSafeCode(firstNumberCodeRange: number, secondNumberCodeRange: number) {
        return setSafeCode(Math.floor(Math.random() * secondNumberCodeRange) + firstNumberCodeRange) ;
    }

    function onNewGame() {
        generateSafeCode(firstNumberCodeRange, secondNumberCodeRange) ;
        dispatch({ type: SAFE_ACTION.NEW_GAME, payload: safeCode });
        dispatch({ type: SAFE_ACTION.TOGGLE_SAFE, payload: false});

        setSafeCodeInputFocused(true);

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
        dispatch({ type: SAFE_ACTION.SET_DISABLED, payload: true });
        dispatch({ type: SAFE_ACTION.SET_GIVE_UP, payload: true });

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
            setSafeCodeInputFocused(true);
        }
    }, [state.safeOpen]);

    function onShowHint() {
        dispatch({ type: SAFE_ACTION.TOGGLE_HINT });
        setSafeCodeInputFocused((value) => false);
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

    function onAddLogAction() {
        dispatch({ type: SAFE_ACTION.ADD_LOG, payload: state.inputValue});
    }

    return <div>
        <SafeContainerContext.Provider value={providerState}>
            <div className={styles.safeContainer}>
                <p className={styles.headerText}>The safe code is a number that ranges from 1 to 1000</p>
                <SafeSettings inputCodeRangeNumbers={{ firstNumberCodeRange, setFirstNumberCodeRange, secondNumberCodeRange, setSecondNumberCodeRange}} inputHintRangeNumbers={{firstNumberHintRange, setFirstNumberHintRange, secondNumberHintRange, setSecondNumberHintRange}} ></SafeSettings>

                <div className={styles.safeAndMenuContainer}>

                    <div>
                        <SafeComponent safeOpen={state.safeOpen} />
                        <CatView currentSkinCatViewState={currentSkinCatViewState}  isSafeComponentInitialized={isSafeComponentInitialized} updateCatViewState={updateCatViewState}  onMouseEnter={handleMouseEnter}
                                   onMouseLeave={handleMouseLeave}/>
                        <div className={styles.SafeCodeInputContainer}>
                            <SafeCodeInput focused={safeCodeInputFocused} />
                        </div>

                    </div>
                    <Menu getButtonClass={getButtonClass} menuConfiguration={menuConfiguration} onMenuButtonClickAction={onMenuButtonClick} state={state} />

                </div>
                <div className={styles.logWrapper}>
                    {state.isLogVisible && <LogView ref={logViewRef} logs={state.logs} />}
                </div>

            </div>

        </SafeContainerContext.Provider>
    </div>
}