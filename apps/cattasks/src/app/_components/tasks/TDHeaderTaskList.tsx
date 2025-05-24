import { useState } from 'react';
import styles from './TDHeaderTaskList.module.css';

export default function TDHeaderTaskList() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => {
        setIsOpen(prev => !prev);
    };

    const closeDropdown = () => {
        setIsOpen(false);
    };

    return (
        <div className={styles.taskListDropdown} onMouseLeave={closeDropdown}>
            <button className={styles.dropButton} onClick={toggleDropdown}>
                Название задачи
            </button>
            {isOpen && (
                <div className={styles.dropdownContent} >
                    <a href="#">Link 1</a>
                    <a href="#">Link 2</a>
                    <a href="#">Link 3</a>
                </div>
            )}
        </div>
    );
}