"use client";

import { SafeGameProvider } from "../model/safe-game-provider";
import { useSafeGameContext } from "../model/safe-game-context";
import { selectHintText, selectTerminalPresentation } from "../model/game.selectors";
import { CatAvatar } from "./cat-avatar";
import { GameMenu } from "./game-menu";
import { HintChallengeDialog } from "./hint-challenge-dialog";
import { HistoryPanel } from "./history-panel";
import { SafeCodeForm } from "./safe-code-form";
import { SafeScene } from "./safe-scene";
import styles from "./safe-game-screen.module.css";

function SafeGameScreenContent() {
  const controller = useSafeGameContext();
  const { state } = controller;
  const terminalPresentation = selectTerminalPresentation(state);
  const displayedHint = selectHintText(state.shownHint);

  return (
    <main className={styles.safeGameScreen}>
      <p className={styles.instructions}>Enter a whole code from 1 to 1000.</p>
      <div className={styles.safeRegion}><SafeScene safeOpen={terminalPresentation.safeOpen} /></div>
      <div className={styles.catRegion}><CatAvatar reaction={terminalPresentation.catReaction} onMouseEnter={controller.handleCatEnter} onMouseLeave={controller.handleCatLeave} /></div>
      <div className={styles.codeEntry}>
        <SafeCodeForm inputRef={controller.inputRef} revealedCode={terminalPresentation.revealedCode} />
        {displayedHint && <p className={styles.earnedHint} role="status">{displayedHint}</p>}
      </div>
      <div className={styles.menuRegion}>
        <GameMenu />
      </div>
      {state.historyVisible && <HistoryPanel key={`history-${state.roundId}`} attempts={state.attempts} anchorRef={controller.historyButtonRef} />}
      {state.hintChallenge && <HintChallengeDialog key={`challenge-${state.hintChallenge.roundId}-${state.hintChallenge.challengeId}`} challenge={state.hintChallenge} />}
    </main>
  );
}

export default function SafeGameScreen() {
  return <SafeGameProvider><SafeGameScreenContent /></SafeGameProvider>;
}
