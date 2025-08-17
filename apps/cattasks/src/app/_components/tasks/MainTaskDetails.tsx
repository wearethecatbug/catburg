'use client';
import styles from './MainTaskDetails.module.css';
import React, {useState} from 'react';

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function MainTaskDetails({className, ...rest}: Props) {
    const [isButtonMinimizeActive, setIsButtonMinimizeActive] = useState(false);


    function handleMinimize() {
        setIsButtonMinimizeActive((prev: boolean) => !prev);
    }


    function getButtonMinimizeClass() {
        return isButtonMinimizeActive ? styles.buttonMinimizeActive : styles.buttonMinimizeInactive;
    }

    function getTaskDetailsClass() {
        return `${styles.taskDetailsContainer} ${isButtonMinimizeActive ? styles.hidden : ''}`;
    }


    return (
        <>
            <button
                onClick={handleMinimize}
                className={`${styles.buttonMinimizeBase} ${getButtonMinimizeClass()}`}>
            </button>
            {!isButtonMinimizeActive && (
                <div className={getTaskDetailsClass()}>

                <textarea
                    className={styles.taskDetailsTextArea}

                    placeholder="Введите детали задачи..."
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                />

                </div>
            )}

        </>
    );

}