"use client"
import React from "react";
import {useTaskContext} from '../../Context/TaskProvider';
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
    const {selectPreviousTask, selectNextTask} = useTaskContext();

    return (
        <div className={styles.taskListContainer}>
            <HeaderArrowButtons
                className={styles.arrowButton}
                name="arrowLeft"
                onClick={selectPreviousTask}
                ariaLabel="Select previous task"
            />
            <HeaderTaskListButton className={styles.dropButton}>
                <HeaderTaskListDeleteButton className={styles.deleteButton}/>
            </HeaderTaskListButton>
            <HeaderArrowButtons
                className={styles.arrowButton}
                name={'arrowRight'}
                onClick={selectNextTask}
                ariaLabel="Select next task"
            />
        </div>
    );
}

