import styles from "./game-menu.module.css";
import { useRef } from "react";
import { useSafeGameContext } from "../model/safe-game-context";
import { StoredHintsCard } from "./stored-hints-card";

function MenuIcon({ kind }: { kind: "new" | "give-up" | "hint" | "history" }) {
  if (kind === "new") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5c0-1.2 1.3-1.9 2.3-1.2l11 7.5a1.5 1.5 0 0 1 0 2.4l-11 7.5C7.3 21.4 6 20.7 6 19.5Z" fill="currentColor" /></svg>;
  if (kind === "give-up") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4v5h-5M4 20v-5h5M4.8 8a8 8 0 0 1 13.1-3L20 9M4 15l2.1 4A8 8 0 0 0 19.2 16" /></svg>;
  if (kind === "hint") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a6 6 0 0 0-4 10.5V18h8v-2.5A6 6 0 0 0 12 5Z" fill="currentColor" /><path d="M9 21h6M12 1v1M3.5 4l1 1M1 11h1M21 11h1M19.5 4l-1 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="12" width="5" height="10" rx="1.5" /><rect x="9.5" y="2" width="5" height="20" rx="1.5" /><rect x="17" y="7" width="5" height="15" rx="1.5" /></svg>;
}

/** All card dwell/close state is supplied by the presentation machine. */
export function GameMenu() {
  const controller = useSafeGameContext();
  const { state, presentation } = controller;
  const ended = state.phase !== "playing";
  const facts = state.earnedHintFacts;
  // Pointer close grace keeps the card observable until its reducer-owned deadline.
  const cardVisible = presentation.mode === "STORED_HINTS";
  const touchDwell = useRef<{ pointerId: number; suppressClick: boolean } | null>(null);

  return (
    <nav className={styles.menu} aria-label="Safe game controls">
      <button ref={controller.newGameButtonRef} className={`${styles.menuButton} ${styles.newGame}`} type="button" onClick={controller.startNewRound}>
        <MenuIcon kind="new" /><span>New game</span>
      </button>
      <button className={`${styles.menuButton} ${styles.giveUp}`} type="button" disabled={ended} onClick={controller.surrenderRound}>
        <MenuIcon kind="give-up" /><span>Give up</span>
      </button>
      <div
        className={styles.hintWrap}
        onPointerEnter={(event) => { if (event.pointerType !== "touch") controller.showHintEnter(); }}
        onPointerLeave={(event) => {
          if (event.pointerType === "touch") return;
          const focused = document.activeElement;
          if (
            presentation.mode === "STORED_HINTS" &&
            presentation.inputModality === "keyboard" &&
            focused instanceof Node &&
            event.currentTarget.contains(focused)
          ) return; // Keep a keyboard-open card visible until focus leaves its wrapper.
          controller.showHintLeave();
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (presentation.mode === "STORED_HINTS" && presentation.inputModality === "keyboard" && !(next instanceof Node && event.currentTarget.contains(next))) controller.showHintFocusLeave();
        }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); controller.storedHintsEscape(); } }}
      >
        <button
          ref={controller.hintButtonRef}
          className={`${styles.menuButton} ${styles.hint}`}
          type="button"
          disabled={ended && facts.length === 0}
          aria-describedby={cardVisible ? "stored-hints-card" : undefined}
          onFocus={controller.showHintFocus}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") return;
            touchDwell.current = cardVisible ? null : { pointerId: event.pointerId, suppressClick: false };
            controller.showHintTouchStart();
          }}
          onPointerUp={(event) => {
            const dwell = touchDwell.current;
            if (!dwell || event.pointerType !== "touch" || dwell.pointerId !== event.pointerId) return;
            dwell.suppressClick = presentation.mode === "STORED_HINTS" && presentation.inputModality === "touch";
          }}
          onPointerCancel={(event) => {
            if (touchDwell.current?.pointerId === event.pointerId) controller.showHintLeave();
            touchDwell.current = null;
          }}
          onClick={(event) => {
            const dwell = touchDwell.current;
            if (dwell?.suppressClick && event.detail > 0) {
              touchDwell.current = null;
              return;
            }
            touchDwell.current = null;
            if (ended) controller.showTerminalStoredHints();
            else controller.showHint();
          }}
        >
          <MenuIcon kind="hint" /><span>Show hint</span>
          <img aria-hidden="true" src={`/safe-cat/hint-lamp-${facts.length ? "on" : "off"}-96.webp`} alt="" />
        </button>
        {cardVisible && <StoredHintsCard facts={facts} />}
      </div>
      <button ref={controller.historyButtonRef} className={`${styles.menuButton} ${styles.log}`} type="button" onClick={controller.toggleHistory}>
        <MenuIcon kind="history" /><span>History</span>
      </button>
    </nav>
  );
}
