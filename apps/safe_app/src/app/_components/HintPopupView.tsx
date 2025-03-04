'use client'

import styles from './HintPopupView.module.css'
import {useState} from "react";

type questionData = {
    answer: number;
    questionParts: Array<number>;
}

function generateQuestion(answerNumber: number): questionData {
    //сгенерировать вопрос, который будет отображаться в попапе
    //представить его как какую то задачу из слогаемых, умножаемых или делимых чисел
    //т.е нужно рандомно придумать как разбить число на эти делители и множетили и т.д
    //например сначала сколько будет операций минмиум например 2 максимум 3-5
    //патом определяем что это будет сложение вычитание деление и записываем эти действия в массив
    //я сделал простейший пример когда всегда будет только сложение

    const questionPartCoefficient = Math.floor(Math.random() * 10);
    const firstPart = answerNumber / questionPartCoefficient;
    const secondPart = answerNumber - firstPart;
    return {answer: answerNumber, questionParts: [firstPart, secondPart]};
}

export default function HintPopupView({onCloseHint}: { onCloseHint: () => void }) {
    const [question] = useState(() => generateQuestion(Math.floor(Math.random() * 1000)));

    function onOkButtonClick() {
        //проверка правильности ответа
        // if (проверить значение в инпуте === question.answer) {
        //     console.log("the answer is correct");
        //     onCloseHint();
        // } else {
        //     console.log("the answer is incorrect"); //показать ошибку
    }

    function onCloseButtonClick() {
        onCloseHint();
        console.log("the hint is closed");
    }

    return <>
        <div className={styles.popupContainer}>

            <button onClick={onCloseButtonClick} className={styles.closeButtonContainer}>
            </button>

            <div className={styles.hintInputContainer}>
                <div className={styles.textField}>{question.questionParts.join("+")}</div>
                <div className={styles.equalsSymbol}>=</div>
                <input className={styles.textField} type={'text'} defaultValue={question.answer}/>
            </div>
            <div className={styles.okButtonContainer}>
                <button onClick={onOkButtonClick}/>
            </div>
        </div>
    </>
}