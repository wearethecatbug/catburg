"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SafeGameProvider } from "../model/safe-game-provider";
import { useSafeGameContext } from "../model/safe-game-context";
import {
  selectEarnedHintPresentation,
  selectTerminalPresentation,
} from "../model/game.selectors";
import { CatAvatar } from "./cat-avatar";
import { GameMenu } from "./game-menu";
import { HintChallengeDialog } from "./hint-challenge-dialog";
import { HistoryPanel } from "./history-panel";
import { SafeCodeForm } from "./safe-code-form";
import { SafeScene } from "./safe-scene";
import { CurvedTitle } from "./curved-title";
import { RewardPresentation } from "./reward-presentation";
import styles from "./safe-game-screen.module.css";

function SafeGameScreenContent() {
  const controller = useSafeGameContext();
  const { state } = controller;
  const terminalPresentation = selectTerminalPresentation(state);
  const { statusText: hintStatus, hintsExhausted } =
    selectEarnedHintPresentation(state);
  const [expiredRewardId, setExpiredRewardId] = useState<string | null>(null);
  const successPresentation = controller.hintSuccessPresentation;
  const completionPending = controller.hintSuccessPending;
  const timerAward = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reward =
    state.latestAwardedFactId === expiredRewardId
      ? null
      : (state.earnedHintFacts.find(
          (item) => item.id === state.latestAwardedFactId,
        ) ?? null);
  const hideNormalCat = Boolean(
    state.hintChallenge && !reward && state.revealedMathAnswer === null,
  );
  // Start the full reward lifetime only after success presentation has completed.
  useEffect(() => {
    if (
      completionPending ||
      successPresentation ||
      !reward ||
      timerAward.current === reward.id
    )
      return;
    if (timer.current) clearTimeout(timer.current);
    timerAward.current = reward.id;
    timer.current = setTimeout(() => setExpiredRewardId(reward.id), 5000);
  }, [completionPending, reward, successPresentation]);
  useLayoutEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setExpiredRewardId(null);
    timerAward.current = null;
  }, [state.roundId]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const modalActive = Boolean(
    state.hintChallenge || successPresentation || completionPending,
  );
  useLayoutEffect(() => {
    if (!modalActive) return;
    const body = document.body;
    const html = document.documentElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    // Restore the exact inline state and document position so the modal cannot shift the game scene.
    const previous = {
      bodyCssText: body.style.cssText,
      htmlCssText: html.style.cssText,
    };
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.width = "100%";
    if (scrollbarWidth > 0)
      body.style.paddingRight = `${(Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0) + scrollbarWidth}px`;
    return () => {
      body.style.cssText = previous.bodyCssText;
      html.style.cssText = previous.htmlCssText;
      window.scrollTo(scrollX, scrollY);
    };
  }, [modalActive]);
  return (
    <main className={styles.safeGameScreen}>
      <div className={styles.stage}>
        <header className={styles.header}>
          <CurvedTitle run={controller.titleRun} />
          <p className={styles.instructions}>
            Enter a whole code from 1 to 1000.
          </p>
        </header>
        <p
          className={styles.rewardAnnouncement}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {hintStatus ?? ""}
        </p>
        <div className={styles.safeRegion}>
          <SafeScene
            safeOpen={terminalPresentation.safeOpen}
            dialAngle={controller.dialAngle}
          />
          <div
            className={
              reward
                ? styles.rewardRegion
                : `${styles.catRegion}${hideNormalCat ? ` ${styles.catHidden}` : ""}`
            }
          >
            {reward ? (
              <RewardPresentation fact={reward} />
            ) : (
              <CatAvatar
                reaction={terminalPresentation.catReaction}
                onMouseEnter={controller.handleCatEnter}
                onMouseLeave={controller.handleCatLeave}
              />
            )}
          </div>
        </div>
        <div className={styles.codeEntry}>
          <SafeCodeForm
            inputRef={controller.inputRef}
            revealedCode={terminalPresentation.revealedCode}
          />
          {hintsExhausted && (
            <p aria-hidden="true" className={styles.earnedHint}>
              No further hints are available.
            </p>
          )}
        </div>
        <div className={styles.menuRegion}>
          <GameMenu />
        </div>
      </div>
      {state.historyVisible && (
        <HistoryPanel
          key={`history-${state.roundId}`}
          attempts={state.attempts}
          anchorRef={controller.historyButtonRef}
        />
      )}
      {(state.hintChallenge || successPresentation || completionPending) && (
        <HintChallengeDialog
          key={`challenge-${(state.hintChallenge ?? successPresentation?.challenge ?? completionPending!.challenge).roundId}-${(state.hintChallenge ?? successPresentation?.challenge ?? completionPending!.challenge).challengeId}`}
          challenge={
            state.hintChallenge ??
            successPresentation?.challenge ??
            completionPending!.challenge
          }
          successFactId={successPresentation?.latestAwardedFactId}
          completionPending={Boolean(completionPending)}
        />
      )}
    </main>
  );
}

export default function SafeGameScreen() {
  return (
    <SafeGameProvider>
      <SafeGameScreenContent />
    </SafeGameProvider>
  );
}
