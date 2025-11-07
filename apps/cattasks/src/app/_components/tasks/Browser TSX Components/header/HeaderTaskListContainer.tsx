"use client"
import React from "react";
import {useTaskContext} from '../../context/TaskProvider';
import HeaderArrowButtons from './HeaderArrowButtons';
import styles from './HeaderTaskListContainer.module.css';
import HeaderTaskListButton from "./HeaderTaskListButton";
import HeaderTaskListDeleteButton from './HeaderTaskListDeleteButton';


interface HeaderTaskListContainerProps {
    readonly className?: string;
    readonly children?: React.ReactNode;
}


export default function HeaderTaskListContainer({className, children}: HeaderTaskListContainerProps) {
    // const {tasks, setSelectedId} = useTaskContext();
    const {tasks, selectPreviousTask, selectNextTask, selectedTask} = useTaskContext();
    const hasTasks = tasks.length > 0;

    return (
        <div className={`${styles.taskListContainer} ${className ?? ''}`}>
            <HeaderArrowButtons
                className={styles.arrowButton}
                name="arrowLeft"
                onClick={selectPreviousTask}
                ariaLabel="Select previous task"
                disabled={!hasTasks}
            />
            <HeaderTaskListButton className={styles.dropButton}>
                <HeaderTaskListDeleteButton className={styles.deleteButton}/>
            </HeaderTaskListButton>
            <HeaderArrowButtons
                className={styles.arrowButton}
                name='arrowRight'
                onClick={selectNextTask}
                ariaLabel="Select next task"
                disabled={!hasTasks}
            />
        </div>
    );
}

