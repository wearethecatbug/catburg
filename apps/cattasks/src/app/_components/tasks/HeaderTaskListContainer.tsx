import HeaderTaskListButton from "@/app/_components/tasks/HeaderTaskListButton";
import HeaderArrowButtons from "@/app/_components/tasks/HeaderArrowButtons";
import styles from './HeaderTaskListContainer.module.css';
import React from "react";


interface HeaderTaskListContainerProps {
    readonly className?: string;
}

export default function HeaderTaskListContainer({className}: HeaderTaskListContainerProps) {
    return (
        <div className={`${styles.taskListContainer} ${className ?? ''}`}>
            <HeaderArrowButtons className={styles.arrowButton} name={"arrowLeft"}/>
            <HeaderTaskListButton className={styles.dropButton}/>
            <HeaderArrowButtons className={styles.arrowButton} name={'arrowRight'}/>
        </div>
    );
}