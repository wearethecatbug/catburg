import styles from './SafeCodeInput.module.css';
import {useEffect, useRef} from "react";

import {useSafeContext} from "@/app/_components/safeContainer/SafeContainerContext";
import {SAFE_ACTION} from "@/app/_components/safeContainer/SafeContainerReducer";

const SafeCodeInput = ({focused}:{focused: boolean}) => {

    const {state, dispatch} = useSafeContext();
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        console.log("isWrongSafeCode changed:", state.isWrongSafeCode);
        if (state.isWrongSafeCode) {
            const timer = setTimeout(() => {
                dispatch({type: 'SET_WRONG_SAFE_CODE', payload: false});
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [state.isWrongSafeCode]);

    if (focused) {
        if (inputRef.current)
            inputRef.current.focus();
    }

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

    function onOkButtonClick() {
        if (state.safeCode === null || state.inputValue.trim() === "") return;

        if (state.inputValue === String(state.safeCode)) {
            dispatch({ type: SAFE_ACTION.SET_WIN, payload: true });
            dispatch({ type: SAFE_ACTION.SET_WRONG_SAFE_CODE, payload: false });
        } else {
            dispatch({ type: SAFE_ACTION.SET_WRONG_SAFE_CODE, payload: true });
        }
        dispatch({ type: SAFE_ACTION.ADD_LOG, payload: state.inputValue});
    }

    return (
        <>
            <div className={getCodeContainerClass()}>
                <input className={getCodeInputClass()} id="fname" ref={inputRef} name="fname" {...getInputProps()} />
                <button className={styles.CodeInputButton} disabled={state.isDisabled} onClick={onOkButtonClick}>OK
                </button>
            </div>
        </>
    );

});

export default SafeCodeInput;