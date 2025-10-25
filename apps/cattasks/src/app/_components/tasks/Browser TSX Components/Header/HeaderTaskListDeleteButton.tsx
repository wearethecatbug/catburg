"use client";
import React from 'react';
import {useTaskContext} from '../../Context/TaskProvider';
import styles from './HeaderTaskListDeleteButton.module.css';

type HeaderTaskListDeleteButtonProps = {
    readonly className?: string;
}


export default function HeaderTaskListDeleteButton({className}: HeaderTaskListDeleteButtonProps) {
    const {headerInput, setHeaderInput, setSelectedId} = useTaskContext();

    const handleClear = () => {
        setHeaderInput('');
        // optional: clear selected task so Main shows default
        setSelectedId(null);
    };

    return (
        <button
            type="button"
            className={`${styles.deleteButton} ${className ?? ''}`}
            aria-label="Clear task input"
            onClick={handleClear}
        >
            X
        </button>
    );
}
