"use client";
import styles from './HeaderBtnSolution.module.css';
import {useTaskContext} from "../../Context/TaskProvider";

interface HeaderBtnSolutionProps {
    readonly className?: string;
}

export default function HeaderBtnSolution({className}: HeaderBtnSolutionProps) {
    const {showSolution, selectedTask, toggleShowSolution} = useTaskContext();
    const isDisabled = !selectedTask;

    const handleClick = () => {
        if (isDisabled) return;
        console.log('onclick solution, taskId=', selectedTask?.id);
        toggleShowSolution(); // сам заполнит editorSolution
    };

    const buttonClassName = [
        styles.headerBtnSolution,
        showSolution ? styles.active : '',
        isDisabled ? styles.headerBtnSolutionDisabled : '',
        className ?? '',
    ].join(' ');

    return (
        <button
            type="button"
            className={buttonClassName}
            onClick={handleClick}
            aria-pressed={showSolution}
            aria-disabled={isDisabled}
            disabled={isDisabled}
        >
        </button>
    );
}