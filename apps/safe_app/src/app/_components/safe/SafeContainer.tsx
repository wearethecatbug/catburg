"use client";

import styles from "./SafeContainer.module.css";
import SafeComponent from "@/components/SafeComponent";
import React, { useEffect, useRef, useState } from "react";
import SafeCodeInput from "@/components/SafeCodeInput";
import CatView, { initialCatViewState } from "@/components/CatView";
import {
  SAFE_ACTION,
  useSafeReducer,
} from "@/components/safe/SafeContainerReducer";
import SafeContainerContext, {
  SafeContainerContextType,
} from "@/components/safe/SafeContainerContext";

export default function SafeContainer() {
  const [state, dispatch] = useSafeReducer();

  const providerState: SafeContainerContextType = { state, dispatch };

  const safeCodeInputRef = useRef<HTMLInputElement | null>(null);
  const [isSafeComponentInitialized, setSafeComponentInitialized] =
    useState(false);
  const logViewRef = useRef<HTMLInputElement | null>(null);
  const [currentSkinCatViewState, setCurrentSkinCatViewState] =
    useState<keyof typeof initialCatViewState>("defaultState");
  const [isGiveUpHintActive, setIsGiveUpHintActive] = useState(false);
  const [safeCode, setSafeCode] = useState<number>(0);
  const [firstNumberCodeRange, setFirstNumberCodeRange] = useState<number>(1);
  const [secondNumberCodeRange, setSecondNumberCodeRange] =
    useState<number>(1000);
  const [firstNumberHintRange, setFirstNumberHintRange] = useState(1);
  const [secondNumberHintRange, setSecondNumberHintRange] = useState(1000);
  const [safeCodeInputFocused, setSafeCodeInputFocused] = useState(true);

  useEffect(() => {
    if (state.isWrongSafeCode) {
      dispatch({ type: SAFE_ACTION.ON_USER_WIN, payload: true }); //TODO: можно объеденить все 3 экшена в один сделать экшен ON_USER_WIN
      updateCatViewState("userWin");
    }
  }, [state.isWin]);

  useEffect(() => {
    setSafeComponentInitialized(true);
  }, []);

  const updateCatViewState = (newState: keyof typeof initialCatViewState) => {
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
        updateCatViewState("hintPopupContainerGiveUp");
      } else if (state.isHintVisible) {
        updateCatViewState("hintPopupViewOpen");
      } else {
        updateCatViewState("defaultState");
      }
    }, 1000);
  }

  function onShowLog() {
    dispatch({ type: SAFE_ACTION.TOGGLE_LOG });
  }

  function generateSafeCode(
    firstNumberCodeRange: number,
    secondNumberCodeRange: number,
  ) {
    return setSafeCode(
      Math.floor(Math.random() * secondNumberCodeRange) + firstNumberCodeRange,
    );
  }

  function onNewGame() {
    generateSafeCode(firstNumberCodeRange, secondNumberCodeRange);
    dispatch({ type: SAFE_ACTION.NEW_GAME, payload: safeCode });
    dispatch({ type: SAFE_ACTION.TOGGLE_SAFE, payload: false });

    setSafeCodeInputFocused(true);

    updateCatViewState("defaultState");
  }

  function onGameStart() {
    onNewGame();
  }

  useEffect(() => {
    onGameStart();
  }, []);

  function onGiveUp() {
    dispatch({ type: SAFE_ACTION.SET_DISABLED, payload: true });
    dispatch({ type: SAFE_ACTION.SET_GIVE_UP, payload: true });

    updateCatViewState("giveUpGame");
  }

  useEffect(() => {
    if (state.isGiveUp && state.safeCode !== null) {
      dispatch({ type: SAFE_ACTION.SET_INPUT_VALUE, payload: String(state.safeCode) });
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
      updateCatViewState("hintPopupViewOpen");
    } else if (!state.isHintVisible) {
      setIsGiveUpHintActive(false);
      updateCatViewState("defaultState");
    }
    if (isGiveUpHintActive && state.isHintVisible) {
      updateCatViewState("hintPopupContainerGiveUp");
    }
  }, [state.isHintVisible, isGiveUpHintActive]); // useEffect срабатывает при изменении isHintVisible

  function onAddLogAction() {
    dispatch({ type: SAFE_ACTION.ADD_LOG, payload: state.inputValue });
  }

  return (
    <div>
      <SafeContainerContext.Provider value={providerState}>
        <div className={styles.safeContainer}>
          <div>
            <SafeComponent safeOpen={state.safeOpen} />
            <CatView
              currentSkinCatViewState={currentSkinCatViewState}
              isSafeComponentInitialized={isSafeComponentInitialized}
              updateCatViewState={updateCatViewState}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
            <div className={styles.SafeCodeInputContainer}>
              <SafeCodeInput focused={safeCodeInputFocused} />
            </div>
          </div>
        </div>
      </SafeContainerContext.Provider>
    </div>
  );
}
