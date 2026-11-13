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
            <img
                className={styles.mobileFoxBody}
                data-mobile-fox="body"
                src="/cattasks/mobile-shelf/raised-paws-fox.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                loading="lazy"
                width={882}
                height={1280}
            />
            <img
                className={styles.mobileFoxPaws}
                data-mobile-fox="paws"
                src="/cattasks/mobile-shelf/raised-paws-fox.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                loading="lazy"
                width={882}
                height={1280}
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

