'use client'

import styles from './HintPopupView.module.css'
import React, {useState} from "react";
import {useRef, useEffect} from 'react';
import HintMenu from "@/app/_components/HintMenu";
import HintContainer from "@/app/_components/HintContainer";


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

    function generateRandomNumberInRange(min: number = 0, max: number = 6, operator: string): [number, number]  {
        if (operator  == "/") return getDivisibleNumbers(min, max);
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


export default function HintPopupView({onCloseHint, inputRef }: { onCloseHint: () => void,  inputRef: React.RefObject<HTMLInputElement> }) {
    const [question, setQuestion] = useState(() => generateQuestion());
    const inputRefAnswer = useRef<HTMLInputElement | null>(null); // Создаём ref для инпута
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isDisabled, setIsDisabled] = useState(false);

    // useEffect(() => {
    //     if (inputRefAnswer.current) {
    //         inputRefAnswer.current.value = "";
    //     }
    // }, [question]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    }, [question]);

    function onNewHint() {
        console.log("New hint is clicked!");
        setQuestion(() => generateQuestion());
        if (inputRefAnswer.current) {
            inputRefAnswer.current.value = "";
        }

    }

    function onShowSigns() {
        console.log("Show signs is clicked!");
    }

    function onGiveUpHint() {
        if (inputRefAnswer.current == null) return;
        inputRefAnswer.current.value = question.answer.toString();
        console.log("Give up hint is clicked!");
    }

    const getInputClass = () => {
        if (isValid === true) return `${styles.textInputField} ${styles.valid}`;  // Зеленый стиль при валидном значении
        if (isValid === false) return `${styles.textInputField} ${styles.invalid}`; // Красный стиль при невалидном значении
        return styles.textInputField; // Стандартный стиль (до валидации)
    };

    const getPopupContainerClass = () => {
        if (isDisabled === true) return `${styles.popupContainer} ${styles.disabled}`;
        return styles.popupContainer; // Стандартный стиль
    };


    function onOkButtonClick() {
        if (!inputRefAnswer.current) return;
        console.log("Button OK is clicked!");
        const userAnswer = parseFloat(inputRefAnswer.current.value);
        if (userAnswer === question.answer) {
            console.log("The answer is correct!");
            setIsValid(true);
            setIsDisabled(true);
            setTimeout(() => onCloseHint(), 3000); // Закрываем попап через секунду
        } else {

            setIsValid(false);
        }

    }


    function onCloseButtonClick() {
        onCloseHint();
        console.log("the hint is closed");
    }


    return (
        <>
            <div className={getPopupContainerClass()}>
                <button onClick={onCloseButtonClick} className={styles.closeButtonContainer}/>
                <div className={styles.hintInputContainer}>
                    <div className={styles.textInputField}>{question.questionParts}</div>
                    <div className={styles.equalsSymbol}>=</div>
                    <input ref={inputRefAnswer} type="number" className={getInputClass()}/>
                </div>
                <div onClick={onOkButtonClick} className={`${styles.okButtonContainer}`}/>
                <div className={styles.hintMenuContainer}>
                    <HintMenu onNewHint={onNewHint} onGiveUpHint={onGiveUpHint}
                              onShowSigns={onShowSigns}/>
                </div>
            </div>
        </>
    );
}

