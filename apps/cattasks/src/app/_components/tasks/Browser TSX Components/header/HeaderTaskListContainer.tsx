"use client"
import React from "react";
import {useTaskContext} from '../../context/TaskProvider';
import HeaderArrowButtons from './HeaderArrowButtons';
import styles from './HeaderTaskListContainer.module.css';


interface HeaderTaskListContainerProps {
    readonly className?: string;
}


export default function HeaderTaskListContainer({className}: HeaderTaskListContainerProps) {
    const {tasks, catalogError, selectedTask, selectPreviousTask, selectNextTask} = useTaskContext();
    const hasTasks = tasks.length > 0;
    const identityTitle = selectedTask
        ? selectedTask.title
        : catalogError
            ? 'Tasks unavailable.'
            : hasTasks
                ? 'No task selected.'
                : 'Loading tasks…';

    return (
        <div className={`${styles.headerTaskListContainer} ${className ?? ''}`}>
            <HeaderArrowButtons
                className={styles.taskListArrowButton}
                name="arrowLeft"
                onClick={selectPreviousTask}
                ariaLabel="Select previous task"
                disabled={!hasTasks}
            />
            <div className={styles.taskIdentity}>
                {selectedTask && (
                    <>
                        <span className={styles.taskNumber}>TASK {String(selectedTask.ordinal).padStart(2, "0")}</span>
                    </>
                )}
                <h1 className={styles.taskTitle} title={selectedTask ? identityTitle : undefined}>{identityTitle}</h1>
            </div>
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

