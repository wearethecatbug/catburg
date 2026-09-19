"use client";

import { useLayoutEffect, useRef } from "react";
import type { RoundSource } from "../domain";
import { SafeGameProvider } from "../model/safe-game-provider";
import { useSafeGameContext } from "../model/safe-game-context";
import { selectEarnedHintPresentation, selectTerminalPresentation } from "../model/game.selectors";
import { CatAvatar } from "./cat-avatar";
import { CurvedTitle } from "./curved-title";
import { GameMenu } from "./game-menu";
import { HintChallengeDialog } from "./hint-challenge-dialog";
import { HistoryPanel } from "./history-panel";
import { RewardPresentation } from "./reward-presentation";
import { SafeCodeForm } from "./safe-code-form";
import { SafeScene } from "./safe-scene";
import styles from "./safe-game-screen.module.css";

function SafeGameScreenContent() {
  const controller = useSafeGameContext();
  const screenRef = useRef<HTMLElement | null>(null);
  const headerZoneRef = useRef<HTMLElement | null>(null);
  const characterEffectZoneRef = useRef<HTMLDivElement | null>(null);
  const panelLaneRef = useRef<HTMLDivElement | null>(null);
  const { state, presentation } = controller;
  const terminal = selectTerminalPresentation(state);
  const { hintsExhausted, statusText } = selectEarnedHintPresentation(state);
  const dialogActive = presentation.surface === "hint-dialog";
  const reward = presentation.mode === "HINT_REWARD" ? presentation.award : null;
  const announcement =
    presentation.mode === "HINT_DIALOG" || presentation.mode === "HISTORY"
      ? ""
      : statusText
        ? statusText
        : presentation.mode === "PET_PROMPT" && presentation.promptId === 1
          ? "Pet me"
          : "";

  useLayoutEffect(() => {
    if (!dialogActive) return;
    const body = document.body; const html = document.documentElement;
    const previous = { body: body.style.cssText, html: html.style.cssText, x: window.scrollX, y: window.scrollY };
    html.style.overflow = "hidden"; body.style.overflow = "hidden"; body.style.position = "fixed"; body.style.top = `-${previous.y}px`; body.style.left = `-${previous.x}px`; body.style.right = `${previous.x}px`; body.style.width = "auto";
    return () => { body.style.cssText = previous.body; html.style.cssText = previous.html; window.scrollTo(previous.x, previous.y); };
  }, [dialogActive]);

  useLayoutEffect(() => {
    if (!dialogActive) return;
    const screen = screenRef.current;
    const header = headerZoneRef.current;
    if (!screen || !header) return;
    const updateLaneTop = () => {
      const gap = Number.parseFloat(
        getComputedStyle(screen).getPropertyValue("--header-gap"),
      );
      const headerBottom = header.getBoundingClientRect().bottom;
      screen.style.setProperty(
        "--dialog-lane-top",
        `${Math.max(0, Math.ceil(headerBottom + (Number.isFinite(gap) ? gap : 8)))}px`,
      );
    };
    updateLaneTop();
    const observer = new ResizeObserver(updateLaneTop);
    observer.observe(header);
    window.addEventListener("resize", updateLaneTop);
    window.visualViewport?.addEventListener("resize", updateLaneTop);
    window.visualViewport?.addEventListener("scroll", updateLaneTop);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLaneTop);
      window.visualViewport?.removeEventListener("resize", updateLaneTop);
      window.visualViewport?.removeEventListener("scroll", updateLaneTop);
      screen.style.removeProperty("--dialog-lane-top");
    };
  }, [dialogActive]);

  return (
    <main
      ref={screenRef}
      className={`${styles.safeGameScreen} ${
        presentation.mode === "HISTORY" ? styles.historyOpen : ""
      }`}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          presentation.mode !== "STORED_HINTS"
        )
          return;
        event.preventDefault();
        controller.storedHintsEscape();
      }}
    >
      <div className={styles.stage}>
        <header ref={headerZoneRef} className={`${styles.header} ${styles.headerZone}`}><CurvedTitle run={controller.titleRun} /><p className={styles.instructions}>Enter a whole code from 1 to 1000.</p></header>
        {!dialogActive && presentation.mode !== "HISTORY" && <p className={styles.rewardAnnouncement} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>}
        <div className={styles.gameplayZone}>
          <div className={styles.safeRegion}>
            <SafeScene safeOpen={terminal.safeOpen} dialAngle={controller.dialAngle} />
            <div ref={characterEffectZoneRef} className={styles.characterEffectZone}>
              <div className={styles.characterSlot}>
                <div className={reward ? styles.rewardRegion : styles.catRegion}>
                  {reward ? <RewardPresentation text={reward.text} /> : <CatAvatar presentation={presentation} />}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.codeEntry}>
            <SafeCodeForm
              inputRef={controller.inputRef}
              revealedCode={terminal.revealedCode}
              feedbackLive={presentation.mode !== "HISTORY"}
            />
            {hintsExhausted && <p aria-hidden="true" className={styles.earnedHint}>No further hints are available.</p>}
          </div>
          <div ref={panelLaneRef} className={`${styles.panelLane} ${presentation.mode === "HISTORY" ? styles.panelLaneOpen : ""}`}>
            <div className={styles.menuRegion}><GameMenu /></div>
            {presentation.mode === "HISTORY" && <HistoryPanel attempts={state.attempts} anchorRef={controller.historyButtonRef} headerZoneRef={headerZoneRef} panelLaneRef={panelLaneRef} characterEffectZoneRef={characterEffectZoneRef} onClose={controller.toggleHistory} onActivity={controller.historyActivity} />}
          </div>
        </div>
      </div>
      <div className={styles.dialogLane}>
        {dialogActive && controller.presentationChallenge && <HintChallengeDialog challenge={controller.presentationChallenge} handoff={presentation.mode === "HINT_SUCCESS_HANDOFF" ? presentation : null} />}
      </div>
    </main>
  );
}

export default function SafeGameScreen({ roundSource }: { roundSource?: RoundSource }) {
  return <SafeGameProvider roundSource={roundSource}><SafeGameScreenContent /></SafeGameProvider>;
}
