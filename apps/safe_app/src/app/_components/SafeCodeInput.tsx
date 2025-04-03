import styles from './SafeCodeInput.module.css';
import {useEffect, forwardRef, useState} from "react";

import {useSafeContext} from "@/app/_components/safeContainer/SafeContainerContext";

const SafeCodeInput = forwardRef<HTMLInputElement, {
    onOkButtonClick: () => boolean;
}>(({onOkButtonClick}, ref) => {

    const {state, dispatch} = useSafeContext();

    useEffect(() => {
        console.log("isWrongSafeCode changed:", state.isWrongSafeCode);
        if (state.isWrongSafeCode) {
            const timer = setTimeout(() => {
                dispatch({type: 'SET_WRONG_SAFE_CODE', payload: false});
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [state.isWrongSafeCode]);


    const getCodeInputClass = () => {
        if (state.isWin) return `${styles.CodeInput} ${styles.isWin}`;
        if (state.isWrongSafeCode) return `${styles.CodeInput} ${styles.isWrongSafeCode}`;
        if (state.isGiveUp) return `${styles.CodeInput} ${styles.isGiveUp}`;
        return styles.CodeInput; // Стандартный стиль
    };

    function onChangeInput(e: React.ChangeEvent<HTMLInputElement>) {
        dispatch({type: 'SET_INPUT_VALUE', payload: e.target.value});
    }

    const getCodeContainerClass = () => {
        if (state.isDisabled) {
            console.log(state.isDisabled)
            return `${styles.SafeCodeInputContainer} ${styles.isDisabled}`;
        }

        return styles.SafeCodeInputContainer; // Стандартный стиль
    };


    function getInputProps() {
        if (state.isWin) {
            return {
                type: "text",
                value: "YOU WON!",
                readOnly: true,
            };
        } else {
            return {
                type: "number",
                value: state.inputValue,
                onChange: onChangeInput
            };
        }
    }

    return (
        <>
            <div className={getCodeContainerClass()}>
                <input ref={ref} className={getCodeInputClass()} id="fname"
                       name="fname" {...getInputProps()}  />
                <button className={styles.CodeInputButton} disabled={state.isDisabled} onClick={onOkButtonClick}>OK
                </button>
            </div>
        </>
    );

});
export default SafeCodeInput;