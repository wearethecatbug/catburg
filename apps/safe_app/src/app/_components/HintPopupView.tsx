'use client'

import styles from './HintPopupView.module.css'
import React, {useEffect, useRef, useState} from "react";
import Menu, {MenuConfiguration} from "@/app/_components/Menu";

type questionData = {
    answer: number;
    questionParts: string;
}

function generateQuestion(): questionData {

    const operators: Record<string, (a: number, b: number) => number> = {
        "+": (firstNumber, secondNumber) => firstNumber + secondNumber,
        "-": (firstNumber, secondNumber) => firstNumber - secondNumber,
        "*": (firstNumber, secondNumber) => firstNumber * secondNumber,
        "/": (firstNumber, secondNumber) => secondNumber !== 0 ? firstNumber / secondNumber : firstNumber,
    }

    function generateRandomNumberInRange(min: number = 0, max: number = 6, operator: string): [number, number] {
        if (operator == "/") return getDivisibleNumbers(min, max);
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

    function randomOperator(): string {
        let operatorsKeys = Object.keys(operators);
        return operatorsKeys[Math.floor(Math.random() * operatorsKeys.length)];

    }

    function calculate(num1: number, num2: number, operator: string): number {
        return operators[operator](num1, num2);
    }

    const operator: string = randomOperator();
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
        {id: HintMenuButtons.GIVE_UP_HINT, name: 'Give Up Hint', className: styles.giveUpHint},
        {id: HintMenuButtons.NEW_HINT, name: 'New Hint', className: styles.newHint},
        {id: HintMenuButtons.SIGNS, name: 'Signs', className: styles.signs},
    ],
    style: styles.menuButton
}

export default function HintPopupView({onAddLogAction, onCloseHintAction}: {
    onAddLogAction: (log: string) => void,
    onCloseHintAction: () => void
}) {
    const [question, setQuestion] = useState(() => generateQuestion());
    const inputRefAnswer = useRef<HTMLInputElement | null>(null); // Создаём ref для инпута
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isDisabled, setIsDisabled] = useState(false);

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
        onAddLogAction('Give Up Hint is clicked ' + id);
        switch ( id ) {
            case HintMenuButtons.GIVE_UP_HINT:
                onGiveUpHint();
                break;
            case HintMenuButtons.NEW_HINT:
                onNewHint();
                break;
            case HintMenuButtons.SIGNS:
                onShowSigns();
                break;
            default: onAddLogAction('Unknown button clicked');
                break;
        }
    }

    function onNewHint() {
        setQuestion(() => generateQuestion());
        if (inputRefAnswer.current) {
            inputRefAnswer.current.value = "";
        }
    }

    function onShowSigns() {
        onAddLogAction("Show signs is clicked!");
    }

    function onGiveUpHint() {
        if (inputRefAnswer.current == null) return;
        inputRefAnswer.current.value = question.answer.toString();
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

    function onOkButtonClick() {
        if (!inputRefAnswer.current) return;
        onAddLogAction("Button OK is clicked!");
        const userAnswer = parseFloat(inputRefAnswer.current.value);
        if (userAnswer === question.answer) {
            onAddLogAction("The answer is correct!");
            setIsValid(true);
            setIsDisabled(true);
            setTimeout(() => onCloseHintAction(), 3000); // Закрываем попап через секунду
        } else {

            setIsValid(false);
        }

    }

    function onCloseButtonClick() {
        onCloseHintAction();
        onAddLogAction("the hint is closed");
    }

    return (
        <div style={{backgroundColor: "red", position: "fixed", width: '100%', height: '100%'}}>
            <div className={getPopupContainerClass()}>
                <button onClick={onCloseButtonClick} className={styles.closeButtonContainer}/>
                <div className={styles.hintInputContainer}>
                    <div className={styles.textInputField}>{question.questionParts}</div>
                    <div className={styles.equalsSymbol}>=</div>
                    <input ref={inputRefAnswer} type="number" className={getInputClass()}/>
                </div>
                <div onClick={onOkButtonClick} className={`${styles.okButtonContainer}`}/>
                <div className={styles.hintMenuContainer}>
                    <Menu menuConfiguration={menuButtons} onMenuButtonClickAction={onHintMenuClick}/>
                </div>
            </div>
        </div>
    );
}

