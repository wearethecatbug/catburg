'use client';
import styles from './MainTaskDetails.module.css';
import React, {useState} from 'react';
import {useTaskContext} from '../../Context/TaskProvider';

type Props = React.HTMLAttributes<HTMLDivElement>;


export default function MainTaskDetails({className, ...rest}: Props) {
    const [isMinimized, setIsMinimized] = useState(false);
    const {selectedTask, headerInput} = useTaskContext();


    const buttonClass = isMinimized ? styles.buttonMinimizeActive : styles.buttonMinimizeInactive;

    const isTaskSelected = Boolean(selectedTask);
    // Show details only when header contains both task id and title
    const header = (headerInput ?? '').trim();
    // const hasId = selectedTask.id ? header.includes(selectedTask.id) : false;

    const hasTitle = selectedTask?.title ? header.includes(selectedTask.title) : false;
    const showDescription = hasTitle;

    const descriptionValue = showDescription ? (selectedTask?.description ?? '') : 'Task details';

    const handleToggle = () => {
        if (!isTaskSelected) return;
        setIsMinimized(v => !v);
    };


    return (
        <div className={`${styles.root} ${isMinimized ? styles.min : ''} ${className ?? ''}`} {...rest}>
            <button
                type="button"
                onClick={handleToggle}
                disabled={!isTaskSelected}
                aria-disabled={!isTaskSelected}
                aria-expanded={isTaskSelected ? !isMinimized : false}
                className={`${styles.buttonMinimizeBase} ${buttonClass}`}
                aria-label={isMinimized ? 'Показать детали' : 'Свернуть детали'}
            />
            <div className={styles.taskDetailsContainer} aria-hidden={isMinimized}>
                <div className={styles.capibaraBackground} aria-hidden/>
                <div className={styles.appleBackground} aria-hidden/>
                <textarea
                    className={styles.taskDetailsTextArea}
                    value={descriptionValue}
                    readOnly
                    onFocus={(e) => e.currentTarget.blur()}
                    aria-label={isTaskSelected ? 'Детали задачи' : 'Нет выбранной задачи'}
                />
            </div>
        </div>
    );
}