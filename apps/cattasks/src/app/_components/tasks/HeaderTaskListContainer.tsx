import HeaderTaskListButton from "@/app/_components/tasks/HeaderTaskListButton";
import HeaderArrowButtons from "@/app/_components/tasks/HeaderArrowButtons";
import styles from './HeaderTaskListContainer.module.css';
import React from "react";


interface HeaderTaskListContainerProps {
    readonly children?: React.ReactNode;
    readonly className?: string;
}

export default function HeaderTaskListContainer({children, className}: HeaderTaskListContainerProps) {
    return (
        <div className={styles.taskListContainer}>
            {/*<button className={styles.arrowLeft}/>*/}

            <HeaderArrowButtons className={styles.arrowButton} name={"arrowLeft"}/>
            <HeaderTaskListButton className={styles.dropButton}/>
            <HeaderArrowButtons className={styles.arrowButton} name={'arrowRight'}/>
            {/*<button className={styles.arrowRight}/>*/}
        </div>

    );

}