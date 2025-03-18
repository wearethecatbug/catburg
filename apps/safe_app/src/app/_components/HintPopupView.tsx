'use client'

import styles from './HintPopupView.module.css'
import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from "react";
import Menu, {MenuConfiguration} from "@/app/_components/Menu";
import SignsPopUpView from "@/app/_components/SignsMenuButtons";
import { useSigns } from "@/app/_components/SignsMenuButtons";
import { signsButtons } from "@/app/_components/SignsMenuButtons";


type questionData = {
    answer: number;
    questionParts: string;
}

const QuestionContext = createContext(null);
export function QuestionProvider({ children }) {
    const { activeSign } = useSigns(); // Получаем activeSign из контекста
    const [question, setQuestion] = useState(() => generateQuestion(activeSign ));
    function updateQuestion() {
        setQuestion(generateQuestion(activeSign ));
    }

    return (
        <QuestionContext.Provider value={{ question, updateQuestion }}>
            {children}
        </QuestionContext.Provider>
    );
}

export function useQuestion() {
    const context = useContext(QuestionContext);
    if (!context) {
        throw new Error("useQuestion must be used within a QuestionProvider");
    }
    return context;
}


function generateQuestion(activeSign: string): questionData  {


    const operators: Record<string, (a: number, b: number) => number> = {
        "+": (firstNumber, secondNumber) => firstNumber + secondNumber,
        "-": (firstNumber, secondNumber) => firstNumber - secondNumber,
        "*": (firstNumber, secondNumber) => firstNumber * secondNumber,
        "÷": (firstNumber, secondNumber) => secondNumber !== 0 ? firstNumber / secondNumber : firstNumber,
    }


    function generateRandomNumberInRange(min: number = 0, max: number = 6, operator: string): [number, number] {
        if (operator == "÷") return getDivisibleNumbers(min, max);
        const num1 = Math.floor(Math.random() * (max - min + 1)) + min;
        const num2 = Math.floor(Math.random() * (max - min + 1)) + min;
        return [num1, num2];
    }

    function getDivisibleNumbers(min = 1, max = 100): [number, number] {
        let divisor = Math.floor(Math.random() * (max - min + 1)) + min; // Генерируем делитель
        let quotient = Math.floor(Math.random() * (max / divisor)) + 1; // Выбираем случайный множитель
        let dividend = divisor * quotient; // Получаем делимое
        return [dividend, divisor];
    }

    function getOperator(): string {
        if (!activeSign) {
            let operatorsKeys = Object.keys(operators);
            return operatorsKeys[Math.floor(Math.random() * operatorsKeys.length)];

        }
        return activeSign;
    }


    function calculate(num1: number, num2: number, operator: string): number {
        return operators[operator](num1, num2);
    }

    const operator = getOperator();
    const [firstNumber, secondNumber] = generateRandomNumberInRange(1, 100, operator);
    const correctAnswerNumber: number = calculate(firstNumber, secondNumber, operator);

    return {answer: correctAnswerNumber, questionParts: `${firstNumber} ${operator} ${secondNumber}`};
}


enum HintMenuButtons {
    GIVE_UP_HINT = 'giveUpHint',
    NEW_HINT = 'newHint',
    SIGNS = 'signs',

}

const menuButtons: MenuConfiguration = {
    buttons: [
        {id: HintMenuButtons.GIVE_UP_HINT, name: '', className: styles.giveUpHint},
        {id: HintMenuButtons.SIGNS, name: '', className: styles.signs},
        {id: HintMenuButtons.NEW_HINT, name: '', className: styles.newHint},
    ],
    style: styles.menuButton
}

export default function HintPopupView({ onCloseHintAction, safeCodeInputRef, getButtonClass, onGiveUpHintChange  }: {
    onAddLogAction: (log: string) => void,
    onCloseHintAction: () => void,
    getButtonClass: (buttonId: string) => string,
    onGiveUpHintChange: (isActive: boolean) => void,
}) {

    const { question, updateQuestion } = useQuestion();
    const inputRefAnswer = useRef<HTMLInputElement | null>(null); // Создаём ref для инпута
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isDisabled, setIsDisabled] = useState(false);
    const [isGiveUpHint, setIsGiveUpHint] = useState(false);
    const [isSignsVisible, setIsSignsVisible] = useState(false);
    const [isGiveUpHintActive, setIsGiveUpHintActive] = useState(false);


    useEffect(() => {
        if (inputRefAnswer.current) {
            inputRefAnswer.current.value = "";
            inputRefAnswer.current.focus();
        }
    }, [question]);

    useEffect(() => {
        if (inputRefAnswer.current) {
            inputRefAnswer.current.focus();
        }
    }, []);

    function onHintMenuClick(id: string) {
        switch ( id ) {
            case HintMenuButtons.GIVE_UP_HINT:
                onGiveUpHint();
                break;
            case HintMenuButtons.NEW_HINT:
                onNewHint();
                break;
            case HintMenuButtons.SIGNS:
                console.log(HintMenuButtons.SIGNS + "clicked")
                onShowSigns();
                break;
            default:
                break;
        }
    }

    function onShowSigns() {
        console.log("onShowSigns active");
        setIsSignsVisible((prev) => !prev);
    }



    function onGiveUpHint() {
        if (inputRefAnswer.current == null) return;
        setIsGiveUpHintActive(true);
        setIsGiveUpHint(true);
        setIsValid(true);
        inputRefAnswer.current.value = question.answer.toString();
        onGiveUpHintChange(true);
    }

    function onNewHint() {
        updateQuestion();
        setIsValid(null);
        setIsGiveUpHint(false);
        setIsGiveUpHintActive(false);
        onGiveUpHintChange(false);
        if (inputRefAnswer.current) {
            inputRefAnswer.current.value = "";
        }
    }

    const getInputClass = () => {
        if (isValid === true) return `${styles.textInputField} ${styles.valid}`;  // Зеленый стиль при валидном значении
        if (isValid === false) return `${styles.textInputField} ${styles.invalid}`; // Красный стиль при невалидном значении
        return styles.textInputField; // Стандартный стиль (до валидации)
    };

    const getPopupContainerClass = () => {
        if (isDisabled) return `${styles.popupContainer} ${styles.disabled}`;
        return styles.popupContainer; // Стандартный стиль
    };

    const getShieldClass = () => {
        if (isDisabled) return `${styles.shield}`;
        return ``; // Стандартный стиль
    };

    function onOkButtonClick() {
        if (!inputRefAnswer.current) return;
        const userAnswer = parseFloat(inputRefAnswer.current.value);
        if (userAnswer === question.answer) {
            setIsValid(true);
            setIsDisabled(true);
            setTimeout(() => onCloseHintAction(), 2000); // Закрываем попап через секунду
        } else {

            setIsValid(false);
        }

    }


    function onCloseButtonClick() {
        onCloseHintAction();
        if (safeCodeInputRef?.current) {
            safeCodeInputRef.current.focus();
        }
    }

    const handleFocus = () => {
        if (!isValid) {
            setIsValid(null);
            getInputClass();
            inputRefAnswer.current.value = ""
        }
    }


    function getOkButtonClass() {
        if(isGiveUpHint) {
            return `${styles.okButtonContainer} ${styles.okButtonDisabled}`;
        }
        return `${styles.okButtonContainer}`;
    }

    function getButtonClass(buttonId: string): string {
        console.log(`getButtonClass вызван для: ${buttonId}`);

        if (buttonId === HintMenuButtons.GIVE_UP_HINT &&  isGiveUpHintActive ) {
            return `${styles.disabledButton}`;
        }

        return  `${styles.giveUpHint}` || ""; // Стандартные стили
    }

return (
    <div className={getShieldClass()}>
        <div className={getPopupContainerClass()}>
            <button onClick={onCloseButtonClick} className={styles.closeButtonContainer} />
            <div className={styles.hintInputContainer}>
                <div className={styles.textInputField}>{question.questionParts}</div>
                <div className={styles.equalsSymbol}>=</div>
                <input ref={inputRefAnswer} type="number" className={getInputClass()}  onFocus={handleFocus}/>
            </div>
            <div onClick={onOkButtonClick}className={`${getOkButtonClass()} ${styles.okButtonContainer}`} />
            <div className={styles.hintMenuContainer}>
                <Menu menuConfiguration={menuButtons} onMenuButtonClickAction={onHintMenuClick} getButtonClass={getButtonClass}/>
            </div>
            <div>
                <SignsPopUpView getButtonClass={getButtonClass} isSignsVisible={isSignsVisible}/>
            </div>
        </div>
    </div>
);
}


