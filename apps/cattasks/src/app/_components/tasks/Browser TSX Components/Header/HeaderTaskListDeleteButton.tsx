"use client";
import React from "react";
import {useTaskContext} from "../../Context/TaskProvider";
import styles from "./HeaderTaskListDeleteButton.module.css";

type HeaderTaskListDeleteButtonProps = {
    readonly className?: string;
};

export default function HeaderTaskListDeleteButton({className}: HeaderTaskListDeleteButtonProps) {
    const {clearSelectedFields} = useTaskContext();

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        console.log("delete button")
        event.stopPropagation();          // не триггерим контейнер
        clearSelectedFields();            // очищаем контекст
    };

    return (
        <button
            type="button"
            className={`${styles.deleteButton} ${className ?? ""}`.trim()}
            aria-label="Очистить выбор задачи"
            onClick={handleClick}
        >
            X
        </button>
    );
}