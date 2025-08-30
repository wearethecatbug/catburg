'use client';
import styles from './MainTaskDetails.module.css';
import React, {useState} from 'react';

type Props = React.HTMLAttributes<HTMLDivElement>;


export default function MainTaskDetails({className, ...rest}: Props) {
    const [isMin, setIsMin] = useState(false);
    // const [text, setText] = useState('');
    const btnClass = isMin ? styles.buttonMinimizeActive : styles.buttonMinimizeInactive;

    return (
        <div className={`${styles.root} ${isMin ? styles.min : ''} ${className ?? ''}`} {...rest}>
            <button
                type="button"
                onClick={() => setIsMin(v => !v)}
                aria-expanded={!isMin}
                className={`${styles.buttonMinimizeBase} ${btnClass}`}
                aria-label={isMin ? 'Показать детали' : 'Свернуть детали'}
            />
            {/*{!isMin && (*/}
            <div className={styles.taskDetailsContainer} aria-hidden={isMin}>
                <textarea className={styles.taskDetailsTextArea} defaultValue="текст"/>
            </div>
            {/*)}*/}
        </div>
    );
}
