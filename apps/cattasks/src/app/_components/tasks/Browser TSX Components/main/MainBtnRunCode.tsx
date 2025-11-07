"use client";
import React from "react";
import styles from "./MainBtnRunCode.module.css";
import {useTaskContext} from "../../context/TaskProvider";

interface MainBtnRunCodeProps {
    readonly className?: string;
}

export default function MainBtnRunCode({className}: MainBtnRunCodeProps) {
    const {editorUserCode} = useTaskContext();

    const handleClick = () => {
        const userCode = editorUserCode ?? "";
        if (!userCode.trim()) {
            alert("Пользовательский код пустой");
            return;
        }

        try {
            // Выполняем код как есть. Если в нём есть alert/console.log — они сработают.
            const runUserScript = new Function('"use strict";\n' + userCode);
            const returnValue = runUserScript();

            // Дополнительно покажем возвращаемое значение, если оно есть.
            if (typeof returnValue !== "undefined") {
                console.log("[RunCode] Возвращаемое значение:", returnValue);
                try {
                    alert(String(returnValue));
                } catch {
                }
            }
        } catch (error) {
            console.error("[RunCode] Ошибка выполнения:", error);
            alert(`Ошибка выполнения: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    return (
        <button
            type="button"
            className={`${styles.mainBtnRunCode} ${className ?? ""}`}
            aria-label="Run Code"
            onClick={handleClick}
        />
    );
}