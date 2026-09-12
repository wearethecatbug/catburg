import styles from "./game-menu.module.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSafeGameContext } from "../model/safe-game-context";
import { StoredHintsCard } from "./stored-hints-card";

function MenuIcon({ kind }: { kind: "new" | "give-up" | "hint" | "history" }) {
  if (kind === "new") return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4.5c0-1.2 1.3-1.9 2.3-1.2l11 7.5a1.5 1.5 0 0 1 0 2.4l-11 7.5C7.3 21.4 6 20.7 6 19.5Z" fill="currentColor" /></svg>;
  if (kind === "give-up") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 4v5h-5M4 20v-5h5M4.8 8a8 8 0 0 1 13.1-3L20 9M4 15l2.1 4A8 8 0 0 0 19.2 16" /></svg>;
  if (kind === "hint") return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5a6 6 0 0 0-4 10.5V18h8v-2.5A6 6 0 0 0 12 5Z" fill="currentColor" /><path d="M9 21h6M12 1v1M3.5 4l1 1M1 11h1M21 11h1M19.5 4l-1 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="2" y="12" width="5" height="10" rx="1.5" /><rect x="9.5" y="2" width="5" height="20" rx="1.5" /><rect x="17" y="7" width="5" height="15" rx="1.5" /></svg>;
}

export function GameMenu() {
  const controller = useSafeGameContext();
  const { state } = controller;
  const ended = state.phase !== "playing";
  const hintWrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false); const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const longPress = useRef(false); const touchContact = useRef(false); const touchLongPressOpen = useRef(false); const suppressNextFocus = useRef(false);
  const facts = state.earnedHintFacts;
  const cancelHoverTimer = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } };
  const clearTimers = () => { cancelHoverTimer(); if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; } };
  const resetStoredHintPresentation = () => { clearTimers(); longPress.current = false; touchContact.current = false; touchLongPressOpen.current = false; suppressNextFocus.current = false; setOpen(false); };
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (longTimer.current) clearTimeout(longTimer.current);
    suppressNextFocus.current = false;
  }, []);
  // A new round must not inherit an open card, a queued close, or a long-press from the previous round.
  useLayoutEffect(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
    longPress.current = false;
    touchContact.current = false;
    touchLongPressOpen.current = false;
    suppressNextFocus.current = false;
    setOpen(false);
  }, [state.roundId]);
  // A short grace period lets the pointer reach the card; opening always cancels a stale close first.
  const show = () => { cancelHoverTimer(); if (facts.length) setOpen(true); };
  const closeLater = (event?: React.PointerEvent<HTMLDivElement>) => { cancelHoverTimer(); if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; } touchContact.current = false; if (event?.pointerType === "touch" && touchLongPressOpen.current) return; hoverTimer.current = setTimeout(() => { hoverTimer.current = null; if (hintWrapRef.current?.contains(document.activeElement)) return; setOpen(false); }, 200); };
  const onHintClick = () => { cancelHoverTimer(); if (longPress.current) { longPress.current = false; return; } if (ended) { show(); return; } setOpen(false); controller.showHint(); };
  const onHintWrapBlur = (event: React.FocusEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resetStoredHintPresentation(); };
  const onHintWrapKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    const trigger = controller.hintButtonRef.current;
    const shouldRestoreFocus = Boolean(trigger && document.activeElement !== trigger);
    resetStoredHintPresentation();
    if (shouldRestoreFocus && trigger && !trigger.disabled && trigger.isConnected) {
      suppressNextFocus.current = true;
      trigger.focus();
    }
  };

  return (
    <nav className={styles.menu} aria-label="Safe game controls">
      <button ref={controller.newGameButtonRef} className={`${styles.menuButton} ${styles.newGame}`} type="button" onClick={() => { resetStoredHintPresentation(); suppressNextFocus.current = false; controller.startNewRound(); }}><MenuIcon kind="new" /><span>New game</span></button>
      <button className={`${styles.menuButton} ${styles.giveUp}`} type="button" disabled={ended} onClick={controller.surrenderRound}><MenuIcon kind="give-up" /><span>Give up</span></button>
      <div ref={hintWrapRef} className={styles.hintWrap} onBlur={onHintWrapBlur} onKeyDown={onHintWrapKeyDown} onPointerEnter={(event) => { if (event.pointerType !== "touch" && facts.length) { cancelHoverTimer(); hoverTimer.current = setTimeout(show, 150); } }} onPointerLeave={closeLater}>
        <button ref={controller.hintButtonRef} className={`${styles.menuButton} ${styles.hint}`} type="button" disabled={ended && facts.length === 0} aria-describedby={open ? "stored-hints-card" : undefined} onFocus={() => { if (suppressNextFocus.current) { suppressNextFocus.current = false; return; } if (!touchContact.current) show(); }} onPointerDown={(event) => { if (event.pointerType === "touch" && facts.length) { touchContact.current = true; touchLongPressOpen.current = false; longPress.current = false; if (longTimer.current) clearTimeout(longTimer.current); longTimer.current = setTimeout(() => { longTimer.current = null; longPress.current = true; touchLongPressOpen.current = true; setOpen(true); }, 500); } }} onPointerUp={() => { const wasTouchContact = touchContact.current; touchContact.current = false; if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; } if (wasTouchContact && !longPress.current) suppressNextFocus.current = true; }} onPointerCancel={resetStoredHintPresentation} onClick={onHintClick}><MenuIcon kind="hint" /><span>Show hint</span><img aria-hidden="true" src={`/safe-cat/hint-lamp-${facts.length ? "on" : "off"}-96.webp`} alt="" /></button>
        {open && facts.length > 0 && <StoredHintsCard facts={facts} onPointerEnter={cancelHoverTimer} />}
      </div>
      <button ref={controller.historyButtonRef} className={`${styles.menuButton} ${styles.log}`} type="button" onClick={controller.toggleHistory}><MenuIcon kind="history" /><span>History</span></button>
    </nav>
  );
}
