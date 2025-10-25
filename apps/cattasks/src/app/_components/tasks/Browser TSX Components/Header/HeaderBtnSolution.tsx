"use client";
import styles from './HeaderBtnSolution.module.css';
import {useTaskContext} from "../../Context/TaskProvider";

interface HeaderBtnSolutionProps {
    readonly className?: string;
}

export default function HeaderBtnSolution({className}: HeaderBtnSolutionProps) {
    const {showSolution, setShowSolution, selectedTask} = useTaskContext();
    const isDisabled = !selectedTask;

    const handleClick = () => {
        if (isDisabled) return;
        setShowSolution(!showSolution);
    };

    const btnClass = [
        styles.headerBtnSolution,
        showSolution ? styles.active : '',
        isDisabled ? styles.headerBtnSolutionDisabled : '',
        className ?? ''
    ].join(' ');


    return (
        <button
            type="button"
            className={btnClass}
            onClick={handleClick}
            aria-pressed={showSolution}
            aria-disabled={isDisabled}
            disabled={isDisabled}
        >
        </button>
    );
}