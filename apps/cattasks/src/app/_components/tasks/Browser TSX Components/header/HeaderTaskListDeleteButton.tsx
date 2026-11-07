"use client";
import React from "react";
import {useTaskContext} from "../../context/TaskProvider";
import styles from "./HeaderTaskListDeleteButton.module.css";

type HeaderTaskListDeleteButtonProps = {
    readonly className?: string;
};

export default function HeaderTaskListDeleteButton({className}: HeaderTaskListDeleteButtonProps) {
    const {clearSelection} = useTaskContext();

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();          // не триггерим контейнер
        clearSelection();                 // очищаем контекст
    };

    return (
        <button
            type="button"
            className={`${styles.deleteButton} ${className ?? ""}`.trim()}
            aria-label="Очистить выбор задачи"
            onClick={handleClick}
        >
            ×
        </button>
    );
}
