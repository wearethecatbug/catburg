import styles from './SafeCodeInput.module.css';
import {useEffect, useRef} from "react";

import {useSafeContext} from "@/components/safe/SafeContainerContext";
import {SAFE_ACTION} from "@/components/safe/SafeContainerReducer";

const SafeCodeInput = ({focused}: { focused: boolean }) => {

    const {state, dispatch} = useSafeContext();
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (state.isWrongSafeCode) {
            const timer = setTimeout(() => {
                dispatch({type: SAFE_ACTION.SET_WRONG_SAFE_CODE, payload: false});
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [state.isWrongSafeCode, dispatch]);

    useEffect(() => {
        if (focused && inputRef.current) {
            inputRef.current.focus();
        }
    }, [focused]);

    const getCodeInputClass = () => {
        if (state.isWin) return `${styles.CodeInput} ${styles.isWin}`;
        if (state.isWrongSafeCode) return `${styles.CodeInput} ${styles.isWrongSafeCode}`;
        if (state.isGiveUp) return `${styles.CodeInput} ${styles.isGiveUp}`;
        return styles.CodeInput;
    };

    function onChangeInput(e: React.ChangeEvent<HTMLInputElement>) {
        dispatch({type: SAFE_ACTION.SET_INPUT_VALUE, payload: e.target.value});
    }

    const getCodeContainerClass = () => {
        if (state.isDisabled) {
            return `${styles.SafeCodeInputContainer} ${styles.isDisabled}`;
        }

        return styles.SafeCodeInputContainer;
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
 // Function to handle OK button click and check safe code
    function onOkButtonClick() {
        if (state.safeCode === null || state.inputValue.trim() === "") return;

        if (state.inputValue === String(state.safeCode)) {
            dispatch({type: SAFE_ACTION.SET_WIN, payload: true});
            dispatch({type: SAFE_ACTION.SET_WRONG_SAFE_CODE, payload: false});
        } else {
            dispatch({type: SAFE_ACTION.SET_WRONG_SAFE_CODE, payload: true});
        }
        dispatch({type: SAFE_ACTION.ADD_LOG, payload: state.inputValue});
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

};

export default SafeCodeInput;