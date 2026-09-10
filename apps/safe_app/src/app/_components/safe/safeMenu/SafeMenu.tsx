import Menu, { type MenuConfiguration } from "@/components/Menu";
import styles from "./SafeMenu.module.css";
import { useSafeContext } from "@/components/safe/SafeContainerContext";

enum MenuButtons { NEW_ROUND = "new-round", SURRENDER = "surrender", HINT = "hint", HISTORY = "history" }

const menuConfiguration: MenuConfiguration = {
  buttons: [
    { id: MenuButtons.NEW_ROUND, name: "New game", className: styles.newGame },
    { id: MenuButtons.SURRENDER, name: "Give up", className: styles.giveUp },
    { id: MenuButtons.HINT, name: "Hint unavailable", className: styles.hint, disabled: true },
    { id: MenuButtons.HISTORY, name: "History", className: styles.log },
  ],
  style: styles.menuButton,
};

export function SafeMenu({ onNewRound, onBeforeTerminalAction }: { onNewRound: () => void; onBeforeTerminalAction: () => void }) {
  const { state, dispatch } = useSafeContext();
  const ended = state.phase !== "playing";
  function onMenuButtonClick(id: string) {
    if (id === MenuButtons.NEW_ROUND) onNewRound();
    else if (id === MenuButtons.SURRENDER && !ended) {
      onBeforeTerminalAction();
      dispatch({ type: "surrender" });
    } else if (id === MenuButtons.HISTORY) dispatch({ type: "toggle-history" });
  }
  return <Menu getButtonClass={(id) => id === MenuButtons.NEW_ROUND && ended ? styles.newGameAfterGiveUp : ""} menuConfiguration={menuConfiguration} onMenuButtonClickAction={onMenuButtonClick} disabledButtonIds={ended ? [MenuButtons.SURRENDER] : []} />;
}
