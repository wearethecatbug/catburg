'use client'

import styles from './SafeConainer.module.css';
import SafeComponent from "@/app/_components/SafeComponent";
import SafeMenu from "@/app/_components/SafeMenu";
import LogView from "@/app/_components/LogView";
import {useState} from "react";
import AnswerInputBox from "@/app/_components/AnswerInput";
import HintPopupView from "@/app/_components/HintPopupView";

export default function SafeContainer() {
    const [isLogIsVisible, setIsLogIsVisible] = useState(false);
    const [isHintIsVisible, setIsHintIsVisible] = useState(false);

    function onShowLogIsClicked() {
        setIsLogIsVisible((value) => !value);
    }

    function onNewGame() {

    }

    function onGiveUp() {

    }

    function onShowHint() {
        setIsHintIsVisible((value) => !value);
    }

    return <div>
        <div className={styles.safeContainer}>
            <p className={styles.headerText}>The safe code is a number that ranges from 1 to 1000</p>
            <div className={styles.safeAndMenuContainer}>
                <SafeComponent/>
                <SafeMenu onShowLogIsClicked={onShowLogIsClicked}/>
            </div>

            {isLogIsVisible ?
                <LogView/> : null
            }
            <AnswerInputBox/>
        </div>

        {isHintIsVisible ?
            <HintPopupView/> : null
        }
    </div>
}