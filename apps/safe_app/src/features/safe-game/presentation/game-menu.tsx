import styles from "./game-menu.module.css";
import { useSafeGameContext } from "../model/safe-game-context";

export function GameMenu() {
  const controller = useSafeGameContext();
  const { state } = controller;
  const ended = state.phase !== "playing";

  return (
    <nav className={styles.menu} aria-label="Safe game controls">
      <button ref={controller.newGameButtonRef} className={`${styles.menuButton} ${styles.newGame}`} type="button" onClick={controller.startNewRound}>New game</button>
      <button className={`${styles.menuButton} ${styles.giveUp}`} type="button" disabled={ended} onClick={controller.surrenderRound}>Give up</button>
      <button ref={controller.hintButtonRef} className={`${styles.menuButton} ${styles.hint}`} type="button" disabled={ended} onClick={controller.showHint}>Show hint</button>
      <button ref={controller.historyButtonRef} className={`${styles.menuButton} ${styles.log}`} type="button" onClick={controller.toggleHistory}>History</button>
    </nav>
  );
}
