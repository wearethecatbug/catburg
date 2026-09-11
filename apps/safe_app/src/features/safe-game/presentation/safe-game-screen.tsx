"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SafeGameProvider } from "../model/safe-game-provider";
import { useSafeGameContext } from "../model/safe-game-context";
import { selectEarnedHintStatusText, selectHintsExhausted, selectTerminalPresentation } from "../model/game.selectors";
import { CatAvatar } from "./cat-avatar";
import { GameMenu } from "./game-menu";
import { HintChallengeDialog } from "./hint-challenge-dialog";
import { HistoryPanel } from "./history-panel";
import { SafeCodeForm } from "./safe-code-form";
import { SafeScene } from "./safe-scene";
import { CurvedTitle } from "./curved-title";
import { RewardPresentation } from "./reward-presentation";
import type { EarnedHintFact } from "../domain";
import styles from "./safe-game-screen.module.css";

function SafeGameScreenContent() {
  const controller = useSafeGameContext();
  const { state } = controller;
  const terminalPresentation = selectTerminalPresentation(state);
  const hintStatus = selectEarnedHintStatusText(state);
  const hintsExhausted = selectHintsExhausted(state);
  const [reward, setReward] = useState<EarnedHintFact | null>(null);
  const previousAward = useRef<string | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // An older timeout may not clear a reward that has already been replaced by a newer fact.
  useEffect(() => { const id = state.latestAwardedFactId; if (id && id !== previousAward.current) { const fact = state.earnedHintFacts.find((item) => item.id === id) ?? null; if (fact) { if (timer.current) clearTimeout(timer.current); setReward(fact); timer.current = setTimeout(() => setReward((current) => current?.id === fact.id ? null : current), 5000); } } previousAward.current = id; }, [state.latestAwardedFactId, state.earnedHintFacts]);
  useLayoutEffect(() => { if (timer.current) clearTimeout(timer.current); setReward(null); previousAward.current = null; }, [state.roundId]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <main className={styles.safeGameScreen}>
      <div className={styles.stage}>
      <header className={styles.header}><CurvedTitle run={controller.titleRun} /><p className={styles.instructions}>Enter a whole code from 1 to 1000.</p></header>
      {reward && <div className={styles.rewardRegion}><RewardPresentation fact={reward} /></div>}
      <p className={styles.rewardAnnouncement} role="status" aria-live="polite" aria-atomic="true">{hintStatus ?? ""}</p>
      <div className={styles.safeRegion}><SafeScene safeOpen={terminalPresentation.safeOpen} dialAngle={controller.dialAngle} /></div>
      <div className={styles.catRegion}><CatAvatar reaction={terminalPresentation.catReaction} onMouseEnter={controller.handleCatEnter} onMouseLeave={controller.handleCatLeave} /></div>
      <div className={styles.codeEntry}>
        <SafeCodeForm inputRef={controller.inputRef} revealedCode={terminalPresentation.revealedCode} />
        {hintsExhausted && <p aria-hidden="true" className={styles.earnedHint}>No further hints are available.</p>}
      </div>
      <div className={styles.menuRegion}>
        <GameMenu />
      </div>
      </div>
      {state.historyVisible && <HistoryPanel key={`history-${state.roundId}`} attempts={state.attempts} anchorRef={controller.historyButtonRef} />}
      {state.hintChallenge && <HintChallengeDialog key={`challenge-${state.hintChallenge.roundId}-${state.hintChallenge.challengeId}`} challenge={state.hintChallenge} />}
    </main>
  );
}

export default function SafeGameScreen() {
  return <SafeGameProvider><SafeGameScreenContent /></SafeGameProvider>;
}
