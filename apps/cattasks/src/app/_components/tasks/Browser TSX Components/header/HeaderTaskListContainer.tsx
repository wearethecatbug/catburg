"use client"
import React from "react";
import {useTaskContext} from '../../context/TaskProvider';
import HeaderArrowButtons from './HeaderArrowButtons';
import styles from './HeaderTaskListContainer.module.css';
import HeaderTaskListButton from "./HeaderTaskListButton";


interface HeaderTaskListContainerProps {
    readonly className?: string;
}


export default function HeaderTaskListContainer({className}: HeaderTaskListContainerProps) {
    // const {tasks, setSelectedId} = useTaskContext();
    const {tasks, selectPreviousTask, selectNextTask} = useTaskContext();
    const hasTasks = tasks.length > 0;

    return (
        <div className={`${styles.headerTaskListContainer} ${className ?? ''}`}>
            <HeaderArrowButtons
                className={styles.taskListArrowButton}
                name="arrowLeft"
                onClick={selectPreviousTask}
                ariaLabel="Select previous task"
                disabled={!hasTasks}
            />
            <HeaderTaskListButton className={styles.taskSelectorButtonContainer}/>
            <HeaderArrowButtons
                className={styles.taskListArrowButton}
                name='arrowRight'
                onClick={selectNextTask}
                ariaLabel="Select next task"
                disabled={!hasTasks}
            />
        </div>
    );
}

