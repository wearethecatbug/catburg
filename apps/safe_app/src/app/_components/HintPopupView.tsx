'use client'

import styles from './HintPopupView.module.css'
import React, {useEffect, useRef, useState, createContext, useContext, useCallback} from "react";
import Menu, {MenuConfiguration} from "@/app/_components/Menu";
import SignsPopUpView from "@/app/_components/SignsMenuButtons";
import {useSigns} from "@/app/_components/SignsMenuButtons";
import {signsButtons} from "@/app/_components/SignsMenuButtons";


type questionData = {
    answer: number;
    questionParts: string;
}

const QuestionContext = createContext<{
    question: questionData;
    updateQuestion: () => void;
} | null>(null);

// Создаем контекст
export function QuestionProvider({children, firstNumberHintRange, secondNumberHintRange}) {
    const {activeSign} = useSigns();
    const [question, setQuestion] = useState(() => generateQuestion(activeSign, firstNumberHintRange, secondNumberHintRange));

    useEffect(() => {
        setQuestion(generateQuestion(activeSign, firstNumberHintRange, secondNumberHintRange));
    }, [activeSign, firstNumberHintRange, secondNumberHintRange]);

    function updateQuestion() {
        setQuestion(generateQuestion(activeSign, firstNumberHintRange, secondNumberHintRange));
    }

    return (
        <QuestionContext.Provider value={{question, updateQuestion}}>
            {children}
        </QuestionContext.Provider>
    );
}

// Хук для удобного использования контекста
export function useQuestion() {
    const context = useContext(QuestionContext);
    if (!context) {
        throw new Error("useQuestion must be used within a QuestionProvider");
    }
    return context;
}

function generateQuestion(activeSign: string, firstNumberHintRange: number, secondNumberHintRange: number): questionData {


    const operators: Record<string, (a: number, b: number) => number> = {
        "+": (firstNumber, secondNumber) => firstNumber + secondNumber,
        "-": (firstNumber, secondNumber) => firstNumber - secondNumber,
        "*": (firstNumber, secondNumber) => firstNumber * secondNumber,
        "÷": (firstNumber, secondNumber) => secondNumber !== 0 ? firstNumber / secondNumber : firstNumber,
    }

    // Генерируем случайные числа в заданном диапазоне
    function generateRandomNumberInRange(firstNumberHintRange, secondNumberHintRange, operator: string): [number, number] {
        if (operator == "÷") return getDivisibleNumbers(firstNumberHintRange, secondNumberHintRange);
        const num1 = Math.floor(Math.random() * (secondNumberHintRange - firstNumberHintRange + 1)) + firstNumberHintRange;
        const num2 = Math.floor(Math.random() * (secondNumberHintRange - firstNumberHintRange + 1)) + firstNumberHintRange;
        return [num1, num2];
    }

    // Функция для генерации делимого и делителя
    function getDivisibleNumbers(firstNumberHintRange, secondNumberHintRange): [number, number] {
        let divisor = Math.floor(Math.random() * (secondNumberHintRange - firstNumberHintRange + 1)) + firstNumberHintRange; // Генерируем делитель
        let quotient = Math.floor(Math.random() * (firstNumberHintRange / divisor)) + 1; // Выбираем случайный множитель
        let dividend = divisor * quotient; // Получаем делимое
        return [dividend, divisor];
    }

    // Функция для генерации случайного знака операции
    function getOperator(): string {
        if (!activeSign) {
            let operatorsKeys = Object.keys(operators);
            return operatorsKeys[Math.floor(Math.random() * operatorsKeys.length)];

        }
        return activeSign;
    }

// Функция для вычисления результата операции
    function calculate(num1: number, num2: number, operator: string): number {
        return operators[operator](num1, num2);
    }

    const operator = getOperator();
    const [firstNumber, secondNumber] = generateRandomNumberInRange(firstNumberHintRange, secondNumberHintRange, operator);
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


export default function HintPopupView({
                                          onCloseHintAction, getButtonClass, onGiveUpHintChange, firstNumberHintRange,
                                          setFirstNumberHintRange, secondNumberHintRange, setSecondNumberHintRange
                                      }: {
    onCloseHintAction: () => void,
    getButtonClass: (buttonId: string) => string,
    onGiveUpHintChange: (isActive: boolean) => void,
    firstNumberHintRange: number,
    setFirstNumberHintRange: React.Dispatch<React.SetStateAction<number>>,
    secondNumberHintRange: number,
    setSecondNumberHintRange: React.Dispatch<React.SetStateAction<number>>,
}) {
    const {question, updateQuestion} = useQuestion();
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

    // Функция для обработки нажатия клавиши Hint
    function onHintMenuClick(id: string) {
        switch (id) {
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

    // Функция для обработки нажатия клавиши Signs
    function onShowSigns() {
        console.log("onShowSigns active");
        setIsSignsVisible((prev) => !prev);
    }


    // Функция для обработки нажатия клавиши Give Up Hint
    function onGiveUpHint() {
        if (inputRefAnswer.current == null) return;
        setIsGiveUpHintActive(true);
        setIsGiveUpHint(true);
        setIsValid(true);
        inputRefAnswer.current.value = question.answer.toString();
        onGiveUpHintChange(true);
    }

    // Функция для обработки нажатия клавиши New Hint
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

    // Функция для экранирования кнопок основого меню с помощью CSS
    const getShieldClass = () => {
        if (isDisabled) return `${styles.shield}`;
        return ``; // Стандартный стиль
    };

    // Функция для обработки нажатия клавиши OK
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

// Функция для обработки нажатия клавиши Close
    function onCloseButtonClick() {
        onCloseHintAction();
    }

    // Функция для управления фокусом на инпуте при невалидном ответе
    const handleFocus = () => {
        if (!isValid) {
            setIsValid(null);
            getInputClass();
            inputRefAnswer.current.value = ""
        }
    }


    function getOkButtonClass() {
        if (isGiveUpHint) {
            return `${styles.okButtonContainer} ${styles.okButtonDisabled}`;
        }
        return `${styles.okButtonContainer}`;
    }

    function getButtonClass(buttonId: string): string {
        console.log(`getButtonClass вызван для: ${buttonId}`);

        if (buttonId === HintMenuButtons.GIVE_UP_HINT && isGiveUpHintActive) {
            return `${styles.disabledButton}`;
        }

        return `${styles.giveUpHint}` || ""; // Стандартные стили
    }

    return (
        <>
            <div className={getShieldClass()}>
                <div className={getPopupContainerClass()}>
                    <button onClick={onCloseButtonClick} className={styles.closeButtonContainer}/>
                    <div className={styles.hintInputContainer}>
                        <div className={styles.textInputField}>{question.questionParts}</div>
                        <div className={styles.equalsSymbol}>=</div>
                        <input ref={inputRefAnswer} type="number" className={getInputClass()} onFocus={handleFocus}/>
                    </div>
                    <div onClick={onOkButtonClick} className={`${getOkButtonClass()} ${styles.okButtonContainer}`}/>
                    <div className={styles.hintMenuContainer}>
                        <Menu menuConfiguration={menuButtons} onMenuButtonClickAction={onHintMenuClick}
                              getButtonClass={getButtonClass}/>
                    </div>
                    <div>
                        <SignsPopUpView getButtonClass={getButtonClass} isSignsVisible={isSignsVisible}/>
                    </div>
                </div>
            </div>
        </>
    );
}


