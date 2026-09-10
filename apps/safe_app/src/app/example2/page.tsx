'use client'

import {Audiowide} from 'next/font/google'
import {Example} from "./Example";
import React, { createContext, useContext, useState } from "react";

const audiowide = Audiowide({
    weight: '400',
    subsets: ['latin'],
})

type ExampleQuestion = {
    questionParts: string;
    answer: number;
};

type ExampleQuestionContextValue = {
    question: ExampleQuestion;
    updateQuestion: () => void;
};

type ExampleQuestionProviderProps = { children: React.ReactNode };
type ExampleHintPopupViewProps = { onClose: () => void };

export default function Home() {
    return (
        <App />
    );
}

const QuestionContext = createContext<ExampleQuestionContextValue | null>(null);
function QuestionProvider({ children }: ExampleQuestionProviderProps) {
    const [question, setQuestion] = useState(generateQuestion());

    function updateQuestion() {
        setQuestion(generateQuestion());
    }

    return (
        <QuestionContext.Provider value={{ question, updateQuestion }}>
            {children}
        </QuestionContext.Provider>
    );
}

function HintPopupView({ onClose }: ExampleHintPopupViewProps) {
    const context = useContext(QuestionContext);
    if (!context) throw new Error("HintPopupView must be used within QuestionProvider");
    const { question, updateQuestion } = context;
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const inputRefAnswer = React.useRef<HTMLInputElement | null>(null);

    function onNewHint() {
        updateQuestion(); // Обновляем вопрос в контексте
        setIsValid(null);
        if (inputRefAnswer.current) inputRefAnswer.current.value = "";
    }

    function onOkButtonClick() {
        if (!inputRefAnswer.current) return;
        const userAnswer = parseFloat(inputRefAnswer.current.value);
        setIsValid(userAnswer === question.answer);
    }

    return (
        <div style={{ padding: "20px", border: "1px solid black" }}>
            <h3>Вопрос: {question.questionParts}</h3>
            <input ref={inputRefAnswer} type="number" />
            <button onClick={onOkButtonClick}>Проверить</button>
            <button onClick={onNewHint}>Новый вопрос</button>
            <button onClick={onClose}>Закрыть</button>
            {isValid !== null && <p>{isValid ? "Правильно!" : "Неправильно"}</p>}
        </div>
    );
}

// 4. Главный компонент App
function App() {
    const [isHintVisible, setIsHintVisible] = useState(false);

    return (
        <QuestionProvider>
            <button onClick={() => setIsHintVisible(true)}>Открыть Hint</button>
            {isHintVisible && <HintPopupView onClose={() => setIsHintVisible(false)} />}
        </QuestionProvider>
    );
}

// Функция генерации вопроса
function generateQuestion(): ExampleQuestion {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    return {
        questionParts: `${num1} + ${num2}`,
        answer: num1 + num2,
    };
}

// export default App;
