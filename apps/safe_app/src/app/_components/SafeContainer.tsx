'use client'

import styles from './SafeConainer.module.css';
import SafeComponent from "@/app/_components/SafeComponent";
import SafeMenu from "@/app/_components/SafeMenu";
import LogView from "@/app/_components/LogView";
import {use, useState} from "react";
import AnswerInputBox from "@/app/_components/AnswerInput";
import HintPopupView from "@/app/_components/HintPopupView";


export default function SafeContainer() {
    const [isLogIsVisible, setIsLogIsVisible] = useState(false);
    const [isHintIsVisible, setIsHintIsVisible] = useState(false);
    const [isNewGame, setIsNewGame] = useState(false);
    const [isGiveUp, setGiveUp] = useState(false);

    function onShowLogIsClicked() {
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
                        <AnswerInputBox/>
                    </div>
                </div>
                <SafeMenu onShowLogIsClicked={onShowLogIsClicked} onNewGame={onNewGame} onGiveUp={onGiveUp}
                          onShowHint={onShowHint}/>
            </div>
            {isLogIsVisible ?
                <LogView/> : null
            }

        </div>

        {isHintIsVisible ?
            <HintPopupView onCloseHint={onShowHint}/> : null}
        {/*{isNewGame ?*/}
        {/*    </> : null*/}
        {/*}*/}
        {/*{isGiveUp ?*/}
        {/*    </> : null*/}
        {/*}*/}
    </div>

}