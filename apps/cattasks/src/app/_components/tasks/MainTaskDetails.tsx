'use client';
import styles from './MainTaskDetails.module.css';
import React, {useState} from 'react';

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function MainTaskDetails({className, ...rest}: Props) {
    const [isMinimized, setIsMinimized] = useState(false);

    const handleMinimize = () => {
        setIsMinimized(prev => !prev);
    };

    const getButtonMinimizeClass = () => {
        return isMinimized ? styles.buttonMinimizeActive : styles.buttonMinimizeInactive;
    };

    const getTaskDetailsClass = () => {
        return `${styles.taskDetailsContainer} ${isMinimized ? styles.hidden : ''}`;
    };

    return (
        <div className={`${className ?? ''}`} {...rest}>
            <button
                onClick={handleMinimize}
                className={`${styles.buttonMinimizeBase} ${getButtonMinimizeClass()}`}
                aria-label={isMinimized ? "Expand task details" : "Minimize task details"}
                aria-expanded={!isMinimized}
            />
            {!isMinimized && (
                <div className={getTaskDetailsClass()}>
                    <textarea
                        className={styles.taskDetailsTextArea}
                        placeholder="Enter task details..."
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                        aria-label="Task details"
                        rows={5}
                    />
                </div>
            )}
        </div>
    );
}