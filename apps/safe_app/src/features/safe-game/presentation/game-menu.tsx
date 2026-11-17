import styles from "./game-menu.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useSafeGameContext } from "../model/safe-game-context";
import { StoredHintsCard } from "./stored-hints-card";

type MenuIconProps = {
  kind: "new" | "give-up" | "hint" | "history";
};

function MenuIcon({ kind }: MenuIconProps) {
  if (kind === "new") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5c0-1.2 1.3-1.9 2.3-1.2l11 7.5a1.5 1.5 0 0 1 0 2.4l-11 7.5C7.3 21.4 6 20.7 6 19.5Z" fill="currentColor" /></svg>;
  if (kind === "give-up") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4v5h-5M4 20v-5h5M4.8 8a8 8 0 0 1 13.1-3L20 9M4 15l2.1 4A8 8 0 0 0 19.2 16" /></svg>;
  if (kind === "hint") return <svg className={styles.hintIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path className={styles.hintIconBulb} d="M12 5a6 6 0 0 0-4 10.5V18h8v-2.5A6 6 0 0 0 12 5Z" fill="currentColor" /><path className={styles.hintIconRays} d="M12 1v1M3.5 4l1 1M1 11h1M21 11h1M19.5 4l-1 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path className={styles.hintIconBase} d="M9 21h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="12" width="5" height="10" rx="1.5" /><rect x="9.5" y="2" width="5" height="20" rx="1.5" /><rect x="17" y="7" width="5" height="15" rx="1.5" /></svg>;
}

const POINTER_OPEN_DELAY = 150;
const POINTER_CLOSE_GRACE = 201;
const TOUCH_OPEN_DELAY = 500;

const HINT_BLOCKING_PET_MODES = new Set([
  "PET_NORMAL",
  "PET_NORMAL_LEAVE_GRACE",
  "PET_PROMPT_SUCCESS",
  "PET_MISSED",
]);

type GameMenuProps = {
  historyPanelRef?: RefObject<HTMLDivElement | null>;
  onHistoryCovered?: (covered: boolean) => void;
};

/**
 * Local earned-hint previews keep an open History panel and blocking pet
 * animation intact; normal Stored hints dwell state remains reducer-owned.
 */
export function GameMenu({
  historyPanelRef,
  onHistoryCovered,
}: GameMenuProps) {
  const controller = useSafeGameContext();
  const { state, presentation } = controller;
  const ended = state.phase !== "playing";
  const facts = state.earnedHintFacts;
  // Only committed current-round facts make the decorative lamp ready.
  const hintReady = facts.length > 0;
  const historyOpen = presentation.mode === "HISTORY";
  const petAnimationBlocksHints = HINT_BLOCKING_PET_MODES.has(presentation.mode);
  const [localPreviewOrigin, setLocalPreviewOrigin] = useState<"history" | "animation" | null>(null);
  const [localPreviewVisible, setLocalPreviewVisible] = useState(false);
  const localPreviewOriginRef = useRef<"history" | "animation" | null>(null);
  const localPreviewVisibleRef = useRef(false);
  const localPreviewRoundIdRef = useRef<number | null>(null);
  const hintWrapRef = useRef<HTMLDivElement | null>(null);
  const suppressLocalPreviewFocusRef = useRef(false);
  const previewOpenTimer = useRef<number | null>(null);
  const previewCloseTimer = useRef<number | null>(null);
  const touchDwell = useRef<{ pointerId: number; suppressClick: boolean } | null>(null);
  const localHistoryPreviewVisible = localPreviewOrigin === "history" && localPreviewVisible;
  const cardVisible = presentation.mode === "STORED_HINTS" || localPreviewOrigin !== null && localPreviewVisible;

  const clearPreviewTimers = useCallback(() => {
    if (previewOpenTimer.current !== null) window.clearTimeout(previewOpenTimer.current);
    if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current);
    previewOpenTimer.current = null;
    previewCloseTimer.current = null;
  }, []);
  const clearLocalPreview = useCallback(() => {
    clearPreviewTimers();
    localPreviewOriginRef.current = null;
    localPreviewVisibleRef.current = false;
    localPreviewRoundIdRef.current = null;
    setLocalPreviewOrigin(null);
    setLocalPreviewVisible(false);
  }, [clearPreviewTimers]);
  const showLocalPreview = useCallback((origin: "history" | "animation", delay: number) => {
    if (!hintReady || localPreviewOriginRef.current !== null && localPreviewOriginRef.current !== origin) return;
    if (previewCloseTimer.current !== null) {
      window.clearTimeout(previewCloseTimer.current);
      previewCloseTimer.current = null;
    }
    if (localPreviewOriginRef.current === null) {
      localPreviewOriginRef.current = origin;
      localPreviewRoundIdRef.current = state.roundId;
      setLocalPreviewOrigin(origin);
    }
    if (localPreviewVisibleRef.current) return;
    if (delay === 0) {
      if (previewOpenTimer.current !== null) window.clearTimeout(previewOpenTimer.current);
      previewOpenTimer.current = null;
      localPreviewVisibleRef.current = true;
      setLocalPreviewVisible(true);
      return;
    }
    if (previewOpenTimer.current !== null) return;
    previewOpenTimer.current = window.setTimeout(() => {
      previewOpenTimer.current = null;
      localPreviewVisibleRef.current = true;
      setLocalPreviewVisible(true);
    }, delay);
  }, [hintReady, state.roundId]);
  const hideLocalPreview = useCallback((withGrace: boolean) => {
    if (previewOpenTimer.current !== null) {
      window.clearTimeout(previewOpenTimer.current);
      previewOpenTimer.current = null;
    }
    if (!localPreviewVisibleRef.current) {
      clearLocalPreview();
      return;
    }
    if (!withGrace) {
      clearLocalPreview();
      return;
    }
    if (previewCloseTimer.current !== null) return;
    previewCloseTimer.current = window.setTimeout(() => {
      previewCloseTimer.current = null;
      if (document.activeElement instanceof Node && hintWrapRef.current?.contains(document.activeElement)) return;
      clearLocalPreview();
    }, POINTER_CLOSE_GRACE);
  }, [clearLocalPreview]);
  const restoreHintFocusWithoutReopening = useCallback(() => {
    suppressLocalPreviewFocusRef.current = true;
    controller.hintButtonRef.current?.focus({ preventScroll: true });
    // Focus events are synchronous. A microtask clears the guard when focus
    // was already on the trigger, without relying on a paused fake timer.
    queueMicrotask(() => { suppressLocalPreviewFocusRef.current = false; });
  }, [controller.hintButtonRef]);
  const closeLocalPreviewOnEscape = useCallback(() => {
    if (!localPreviewVisibleRef.current) return;
    const active = document.activeElement;
    hideLocalPreview(false);
    if (active instanceof Node && hintWrapRef.current?.contains(active))
      restoreHintFocusWithoutReopening();
  }, [hideLocalPreview, restoreHintFocusWithoutReopening]);

  useEffect(() => {
    const origin = localPreviewOriginRef.current;
    if (origin === null) return;
    const compatible = origin === "history"
      ? historyOpen && hintReady
      : hintReady && state.phase === "playing" && presentation.surface === "none" && localPreviewRoundIdRef.current === state.roundId;
    if (compatible) return;
    clearLocalPreview();
    touchDwell.current = null;
  }, [clearLocalPreview, hintReady, historyOpen, presentation.surface, state.phase, state.roundId]);
  useEffect(() => () => clearPreviewTimers(), [clearPreviewTimers]);
  useEffect(() => {
    if (!localPreviewVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeLocalPreviewOnEscape();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [closeLocalPreviewOnEscape, localPreviewVisible]);

  return (
    <nav className={styles.menu} aria-label="Safe game controls">
      <button ref={controller.newGameButtonRef} className={`${styles.menuButton} ${styles.newGame}`} type="button" onClick={controller.startNewRound}>
        <MenuIcon kind="new" /><span>New game</span>
      </button>
      <button className={`${styles.menuButton} ${styles.giveUp}`} type="button" disabled={ended} onClick={controller.surrenderRound}>
        <MenuIcon kind="give-up" /><span>Give up</span>
      </button>
      <div
        ref={hintWrapRef}
        className={styles.hintWrap}
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          if (historyOpen) showLocalPreview("history", POINTER_OPEN_DELAY);
          else if (petAnimationBlocksHints || localPreviewOriginRef.current === "animation") showLocalPreview("animation", POINTER_OPEN_DELAY);
          else controller.showHintEnter();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "touch") return;
          if (localPreviewOriginRef.current !== null) {
            const focused = document.activeElement;
            if (focused instanceof Node && event.currentTarget.contains(focused)) return;
            hideLocalPreview(true);
            return;
          }
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
          if (localPreviewOriginRef.current !== null) {
            if (!(next instanceof Node && event.currentTarget.contains(next))) hideLocalPreview(false);
            return;
          }
          if (presentation.mode === "STORED_HINTS" && presentation.inputModality === "keyboard" && !(next instanceof Node && event.currentTarget.contains(next))) controller.showHintFocusLeave();
        }}
      >
        <button
          ref={controller.hintButtonRef}
          className={`${styles.menuButton} ${styles.hint}`}
          data-hint-ready={hintReady}
          type="button"
          disabled={ended && facts.length === 0}
          aria-describedby={cardVisible ? "stored-hints-card" : undefined}
          onFocus={() => {
            if (suppressLocalPreviewFocusRef.current) {
              suppressLocalPreviewFocusRef.current = false;
              return;
            }
            if (historyOpen) {
              showLocalPreview("history", 0);
            }
            else if (petAnimationBlocksHints || localPreviewOriginRef.current === "animation") {
              showLocalPreview("animation", 0);
            }
            else controller.showHintFocus();
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") return;
            touchDwell.current = cardVisible ? null : { pointerId: event.pointerId, suppressClick: false };
            if (historyOpen) showLocalPreview("history", TOUCH_OPEN_DELAY);
            else if (petAnimationBlocksHints || localPreviewOriginRef.current === "animation") showLocalPreview("animation", TOUCH_OPEN_DELAY);
            else controller.showHintTouchStart();
          }}
          onPointerUp={(event) => {
            const dwell = touchDwell.current;
            if (!dwell || event.pointerType !== "touch" || dwell.pointerId !== event.pointerId) return;
            dwell.suppressClick = localPreviewOriginRef.current !== null
              ? localPreviewVisibleRef.current
              : presentation.mode === "STORED_HINTS" && presentation.inputModality === "touch";
            // A short touch remains a normal activation; it must not leave a
            // pending long-press timer that opens the preview after navigation.
            if (localPreviewOriginRef.current !== null && !dwell.suppressClick) hideLocalPreview(false);
          }}
          onPointerCancel={(event) => {
            if (touchDwell.current?.pointerId === event.pointerId) {
              if (localPreviewOriginRef.current !== null) hideLocalPreview(false);
              else controller.showHintLeave();
            }
            touchDwell.current = null;
          }}
          onClick={(event) => {
            const dwell = touchDwell.current;
            if (dwell?.suppressClick && event.detail > 0) {
              touchDwell.current = null;
              return;
            }
            touchDwell.current = null;
            if (historyOpen) {
              if (ended) showLocalPreview("history", 0);
              else controller.showHint();
            } else if (ended) controller.showTerminalStoredHints();
            else controller.showHint();
          }}
        >
          <MenuIcon kind="hint" /><span>Show hint</span>
        </button>
        {cardVisible && <StoredHintsCard facts={facts} historyPanelRef={localHistoryPreviewVisible ? historyPanelRef : undefined} onHistoryCovered={localHistoryPreviewVisible ? onHistoryCovered : undefined} />}
      </div>
      <button ref={controller.historyButtonRef} className={`${styles.menuButton} ${styles.log}`} type="button" onClick={controller.toggleHistory}>
        <MenuIcon kind="history" /><span>History</span>
      </button>
    </nav>
  );
}
