'use client'

import styles from './SafeConainer.module.css';
import SafeComponent from "@/app/_components/SafeComponent";
import LogView from "@/app/_components/LogView";
import React, { useEffect, useRef, useState } from "react";
import AnswerInputBox from "@/app/_components/AnswerInput";
import HintPopupView from "@/app/_components/HintPopupView";
import Menu, {MenuConfiguration} from "@/app/_components/Menu";

enum MenuButtons {
    ON_NEW_GAME = 'onNewGame',
    ON_GIVE_UP = 'onGiveUp',
    ON_SHOW_HINT = 'onShowHint',
    ON_SHOW_LOG = 'onShowLog',
}

const menuConfiguration: MenuConfiguration = {
    buttons: [
        {id: MenuButtons.ON_NEW_GAME, name: 'new game', className: styles.newGame},
        {id: MenuButtons.ON_GIVE_UP, name: 'give up', className: styles.giveUp},
        {id: MenuButtons.ON_SHOW_HINT, name: 'show hint', className: styles.hint},
        {id: MenuButtons.ON_SHOW_LOG, name: 'show log', className: styles.log},
    ],
    style: styles.menuButton
}

export default function SafeContainer() {
    const [isLogIsVisible, setIsLogIsVisible] = useState(false);
    const [isHintIsVisible, setIsHintIsVisible] = useState(false);
    const [isNewGame, setIsNewGame] = useState(false);
    const [isGiveUp, setGiveUp] = useState(false);

    function onMenuButtonClick(id: string) {
        console.log('Give Up Hint is clicked', id);
        switch ( id ) {
            case MenuButtons.ON_NEW_GAME:
                onNewGame();
                break;
            case MenuButtons.ON_GIVE_UP:
                onGiveUp();
                break;
            case MenuButtons.ON_SHOW_HINT:
                onShowHint();
                break;
            case MenuButtons.ON_SHOW_LOG:
                onShowLog();
                break;
            default: console.log('Unknown button clicked');
                break;
        }
    }

    function onShowLog() {
        setIsLogIsVisible((value) => !value);
    }

    function onNewGame() {
        setIsNewGame(value => !value);
        console.log('onNewGame click');
    }

    function onGiveUp() {
        setGiveUp(value => !value);
        console.log('onGiveUp click');
    }

    function onShowHint() {
        setIsHintIsVisible((value) => !value);

        console.log('onShowHint click');
    }

    return <div>
        <div className={styles.safeContainer}>
            <p className={styles.headerText}>The safe code is a number that ranges from 1 to 1000</p>
            <div className={styles.safeAndMenuContainer}>
                <div>
                    <SafeComponent/>

                    <div className={styles.AnswerInputContainer}>
                        <AnswerInputBox />
                    </div>
                </div>
                <Menu menuConfiguration={menuConfiguration} onMenuButtonClickAction={onMenuButtonClick}/>
            </div>
            {isLogIsVisible ?
                <LogView/> : null
            }

        </div>

        {isHintIsVisible ?
            <HintPopupView onCloseHintAction={onShowHint}/> : null}
        {/*{isNewGame ?*/}
        {/*    </> : null*/}
        {/*}*/}
        {/*{isGiveUp ?*/}
        {/*    </> : null*/}
        {/*}*/}

    </div>

}