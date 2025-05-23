import Menu, { MenuConfiguration } from "@/components/Menu";
import styles from "./SafeMenu.module.css";
import { useSafeReducer } from "@/components/safe/SafeContainerReducer";

enum MenuButtons {
  ON_NEW_GAME = "onNewGame",
  ON_GIVE_UP = "onGiveUp",
  ON_SHOW_HINT = "onShowHint",
  ON_SHOW_LOG = "onShowLog",
}

const menuConfiguration: MenuConfiguration = {
  buttons: [
    {
      id: MenuButtons.ON_NEW_GAME,
      name: "new game",
      className: styles.newGame,
    },
    { id: MenuButtons.ON_GIVE_UP, name: "give up", className: styles.giveUp },
    { id: MenuButtons.ON_SHOW_HINT, name: "show hint", className: styles.hint },
    { id: MenuButtons.ON_SHOW_LOG, name: "show log", className: styles.log },
  ],
  style: styles.menuButton,
};

function onMenuButtonClick(id: string) {}

/*
function onMenuButtonClick(id: string) {
    switch (id) {
        case MenuButtons.ON_NEW_GAME:
            //onNewGame();
            break;
        case MenuButtons.ON_GIVE_UP:
            //onGiveUp();
            break;
        case MenuButtons.ON_SHOW_HINT:
            //onShowHint();
            break;
        case MenuButtons.ON_SHOW_LOG:
            //onShowLog();
            break;
        default:
            console.log("Unknown button clicked");
            break;
    }
}
*/

export function SafeMenu() {
  const [state, dispatch] = useSafeReducer();
  const getButtonClass = (id: string) => {
    if (
      (id === MenuButtons.ON_GIVE_UP || id === MenuButtons.ON_SHOW_HINT) &&
      (state.isGiveUp || state.isWin)
    ) {
      return styles.disabledButton;
    }
    if (id === MenuButtons.ON_NEW_GAME && (state.isGiveUp || state.isWin)) {
      return styles.newGameAfterGiveUp;
    }
    return "";
  };

  return (
    <Menu
      getButtonClass={getButtonClass}
      menuConfiguration={menuConfiguration}
      onMenuButtonClickAction={() => {
        /*onMenuButtonClick*/
      }}
      state={state}
    />
  );
}
