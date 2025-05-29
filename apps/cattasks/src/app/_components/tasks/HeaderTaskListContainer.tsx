import HeaderTaskListButton from "@/app/_components/tasks/HeaderTaskListButton";
import styles from './HeaderTaskListContainer.module.css';
import React from "react";
import HeaderArrowButtons from "@/app/_components/tasks/HeaderArrowButtons";


interface HeaderTaskListContainerProps {
    readonly children?: React.ReactNode;
    readonly className?: string;
}

export default function HeaderTaskListContainer({children, className}: HeaderTaskListContainerProps) {
    return (
        <div className={styles.taskListContainer}>
            <HeaderArrowButtons className={styles.arrowButton} name={"arrowLeft"}/>
            <HeaderTaskListButton className={styles.dropButton}/>
            <HeaderArrowButtons className={styles.arrowButton} name={'arrowRight'}/>
        </div>

    );

}