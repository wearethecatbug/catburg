"use client"
import React, {useEffect, useRef, useState} from 'react';
import styles from './HeaderTaskListButton.module.css';


// type TDHeaderTaskListProps = {
//     // readonly children?: React.ReactNode;
//     readonly className?: string;
// };

export default function HeaderTaskListButton() {
    const [isOpen, setIsOpen] = useState(false);
    const taskListRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const toggleDropdown = () => setIsOpen(prev => !prev);
    const closeDropdown = () => setIsOpen(false);

    // Фокусируем меню при открытии, чтобы ловить onKeyDown, без этого escape не будет работать
    useEffect(() => {
        if (isOpen && taskListRef.current) {
            taskListRef.current.focus();
        }
    }, [isOpen]);

    // Закрыть меню по нажатию Escape
    const handleTaskListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDropdown();

        }
    };

    // Закрыть по клику вне меню
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                isOpen &&
                !taskListRef.current?.contains(e.target as Node) && // оператор "?" проверяет, что taskListRef.current не null
                !buttonRef.current?.contains(e.target as Node)
            ) {
                closeDropdown();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (

        <div className={styles.dropButtonWrapper}>


            <button
                ref={buttonRef}
                className={styles.dropButton}
                onClick={toggleDropdown}
                // onKeyDown={handleButtonKeyDown}
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <input className={styles.dropButtonInput}/>
            </button>
            {isOpen && (
                <div
                    ref={taskListRef}
                    className={styles.dropdownContent}
                    role="menu"
                    tabIndex={-1}
                    onKeyDown={handleTaskListKeyDown}
                >
                    <a href="#" role="menuitem" tabIndex={0}>Link 1</a>
                    <a href="#" role="menuitem" tabIndex={0}>Link 2</a>
                    <a href="#" role="menuitem" tabIndex={0}>Link 3</a>
                </div>
            )}
        </div>
    );
}