import type { RefObject } from "react";
import { createHintChallenge } from "@/domain/safe-game";
import styles from "./SafeMenu.module.css";
import { useSafeContext } from "@/components/safe/SafeContainerContext";

type SafeMenuProps = {
  onNewRound: () => void;
  onBeforeTerminalAction: () => void;
  hintButtonRef: RefObject<HTMLButtonElement | null>;
  historyButtonRef: RefObject<HTMLButtonElement | null>;
};

function createChallengeId() {
  return globalThis.crypto?.randomUUID?.() ?? `hint-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SafeMenu({ onNewRound, onBeforeTerminalAction, hintButtonRef, historyButtonRef }: SafeMenuProps) {
  const { state, dispatch } = useSafeContext();
  const ended = state.phase !== "playing";

  return (
    <nav className={styles.menu} aria-label="Safe game controls">
      <button className={`${styles.menuButton} ${styles.newGame} ${ended ? styles.newGameAfterGiveUp : ""}`} type="button" onClick={onNewRound}>New game</button>
      <button className={`${styles.menuButton} ${styles.giveUp}`} type="button" disabled={ended} onClick={() => {
        onBeforeTerminalAction();
        dispatch({ type: "surrender" });
      }}>Give up</button>
      <button ref={hintButtonRef} className={`${styles.menuButton} ${styles.hint}`} type="button" disabled={ended} onClick={() => dispatch({ type: "show-hint", challenge: createHintChallenge(Math.random, state.roundId, "+", createChallengeId()) })}>Show hint</button>
      <button ref={historyButtonRef} className={`${styles.menuButton} ${styles.log}`} type="button" onClick={() => dispatch({ type: "toggle-history" })}>History</button>
    </nav>
  );
}
