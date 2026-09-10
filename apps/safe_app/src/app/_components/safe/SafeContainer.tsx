"use client";

import styles from "./SafeContainer.module.css";
import { useEffect, useRef } from "react";
import { generateSafeCode } from "@/domain/safe-game";
import SafeComponent from "@/components/SafeComponent";
import SafeCodeInput from "@/components/SafeCodeInput";
import CatView from "@/components/CatView";
import LogView from "@/components/LogView";
import { SafeMenu } from "@/components/safe/safeMenu/SafeMenu";
import { useSafeReducer } from "@/components/safe/SafeContainerReducer";
import SafeContainerContext from "@/components/safe/SafeContainerContext";
import HintChallenge from "@/components/safe/hintChallenge/HintChallenge";

export default function SafeContainer() {
  const [state, dispatch] = useSafeReducer();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hintButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusRound = state.roundId;

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusRound]);

  useEffect(() => () => {
    if (pendingHoverTimer.current) clearTimeout(pendingHoverTimer.current);
  }, []);

  useEffect(() => {
    if (state.phase !== "playing") clearPendingHoverTimer();
  }, [state.phase]);

  function clearPendingHoverTimer() {
    if (pendingHoverTimer.current) {
      clearTimeout(pendingHoverTimer.current);
      pendingHoverTimer.current = null;
    }
  }

  function startNewRound() {
    clearPendingHoverTimer();
    dispatch({ type: "new-round", code: generateSafeCode() });
  }

  function handleCatEnter() {
    clearPendingHoverTimer();
    dispatch({ type: "set-cat-hover", active: true });
  }

  function handleCatLeave() {
    clearPendingHoverTimer();
    const roundId = state.roundId;
    pendingHoverTimer.current = setTimeout(() => {
      // A delayed hover result belongs only to the round that scheduled it.
      if (state.phase === "playing" && state.roundId === roundId) {
        dispatch({ type: "set-cat-hover", active: false });
      }
    }, 250);
  }

  return (
    <SafeContainerContext.Provider value={{ state, dispatch }}>
      <main className={styles.safeContainer}>
        <p className={styles.instructions}>Enter a whole code from 1 to 1000.</p>
        <div className={styles.safeRegion}><SafeComponent safeOpen={state.safeOpen} /></div>
        <div className={styles.catRegion}><CatView reaction={state.catReaction} onMouseEnter={handleCatEnter} onMouseLeave={handleCatLeave} /></div>
        <div className={styles.SafeCodeInputContainer}>
          <SafeCodeInput inputRef={inputRef} />
          {state.shownHint && <p className={styles.earnedHint} role="status">{state.shownHint}</p>}
        </div>
        <div className={styles.menuRegion}>
          <SafeMenu
            hintButtonRef={hintButtonRef}
            historyButtonRef={historyButtonRef}
            onNewRound={startNewRound}
            onBeforeTerminalAction={clearPendingHoverTimer}
          />
        </div>
        {state.historyVisible && <LogView attempts={state.attempts} anchorRef={historyButtonRef} />}
        {state.hintChallenge && <HintChallenge challenge={state.hintChallenge} openerRef={hintButtonRef} />}
      </main>
    </SafeContainerContext.Provider>
  );
}
