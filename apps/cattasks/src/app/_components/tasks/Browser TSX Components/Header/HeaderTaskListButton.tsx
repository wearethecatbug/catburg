"use client"
import React, {useEffect, useRef, useState} from "react";
import styles from "./HeaderTaskListButton.module.css";
import {useTasksArr} from "../../Hooks/UseTasks";
import {ParsedTask} from "../../lib/ParseTasksArr";
import {useTaskContext} from "../../Context/TaskProvider";

type TDHeaderTaskListProps = {
    readonly className?: string
    readonly children?: React.ReactNode;
};

export default function HeaderTaskListButton({className = '', children}: TDHeaderTaskListProps) {
    const [isOpen, setIsOpen] = useState(false);
    const {setSelectedId, headerInput, setHeaderInput, clearSelectedFields} = useTaskContext();
    const dropdownContentRef = useRef<HTMLDivElement>(null);
    const buttonContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [openedByTyping, setOpenedByTyping] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
    const tasks = useTasksArr() ?? [];
    const menuId = "headerTaskListMenu";

    const toggleDropdown = () => {
        setOpenedByTyping(false);
        setIsOpen(prev => !prev);
    };

    const filteredTasks = tasks.filter(task => {
        const input = (headerInput ?? '').trim().toLowerCase();
        return (
            task.title.toLowerCase().includes(input) ||
            task.no.toString().includes(input) ||
            `${task.no}.`.toLowerCase().includes(input)
        );
    });

    const listSource = (!openedByTyping && isOpen && (headerInput ?? '').trim() !== '')
        ? tasks
        : ((headerInput ?? '').trim() ? filteredTasks : tasks);

    const closeDropdown = () => setIsOpen(false);

    useEffect(() => {
        if (isOpen && !openedByTyping) dropdownContentRef.current?.focus();
    }, [isOpen, openedByTyping]);

    const focusListItem = (index: number) => {
        requestAnimationFrame(() => {
            const lis = dropdownContentRef.current?.querySelectorAll<HTMLLIElement>('li');
            const li = lis?.[index];
            if (li) li.focus();
        });
    };

    // keep highlightIndex valid when list changes
    useEffect(() => {
        if (highlightIndex !== null && (highlightIndex < 0 || highlightIndex >= listSource.length)) {
            setHighlightIndex(null);
        }
    }, [listSource, highlightIndex]);

    const handleSelectTask = (task: ParsedTask) => {
        closeDropdown();
        clearSelectedFields();
        setHeaderInput(`${task.no}. ${task.title}`);
        inputRef.current?.focus();
        setSelectedId(task.id);

        console.log("Selected task:", task.id);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setHeaderInput(newValue);

        if (newValue.trim() !== '') {
            const matches = tasks.filter(task => {
                const input = newValue.trim().toLowerCase();
                return (
                    task.title.toLowerCase().includes(input) ||
                    task.no.toString().includes(input) ||
                    `${task.no}.`.toLowerCase().includes(input)
                );
            });

            if (matches.length > 0) {
                setOpenedByTyping(true);
                setIsOpen(true);
            }
        } else {
            setIsOpen(false);
        }
    };


    const handleClear = () => {
        clearSelectedFields();
        setSelectedId(null);
        closeDropdown();
    };

    // Handle keyboard navigation within the dropdown (when focus is inside dropdown)
    const handleTaskListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeDropdown();
            inputRef.current?.focus();
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const idx = highlightIndex;
            if (idx !== null) {
                const task = listSource[idx];
                if (task) handleSelectTask(task);
            } else {
                // if nothing highlighted, try to find focused li
                const lis = dropdownContentRef.current?.querySelectorAll<HTMLLIElement>('li');
                const focused = Array.from(lis ?? []).findIndex(li => li === document.activeElement);
                if (focused >= 0) {
                    const task = listSource[focused];
                    if (task) handleSelectTask(task);
                }
            }
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            const next = (highlightIndex === null) ? 0 : Math.min(highlightIndex + 1, listSource.length - 1);
            setHighlightIndex(next);
            focusListItem(next);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            const prev = (highlightIndex === null) ? Math.max(0, listSource.length - 1) : Math.max(highlightIndex - 1, 0);
            setHighlightIndex(prev);
            focusListItem(prev);
            return;
        }
    };

    // Handle keyboard events on the input field
    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeDropdown();
            inputRef.current?.focus();
            return;
        }
        if (event.key === "ArrowDown" && event.altKey) {
            event.preventDefault();
            setOpenedByTyping(false);
            setIsOpen(true);
            setTimeout(() => {
                if (listSource.length > 0) {
                    setHighlightIndex(0);
                    focusListItem(0);
                }
            }, 0);
            return;
        }

        // If dropdown is closed -> open and focus first li
        if (!isOpen) {
            setOpenedByTyping(false);
            setIsOpen(true);
            setTimeout(() => {
                if (listSource.length > 0) {
                    setHighlightIndex(0);
                    focusListItem(0);
                }
            }, 0);
            return;
        }

        // If dropdown is open and an item is highlighted -> select it on Enter
        if (event.key === "Enter") {
            event.preventDefault();
            if (highlightIndex !== null) {
                const task = listSource[highlightIndex];
                if (task) handleSelectTask(task);
                return;
            }
            // if nothing highlighted, focus first
            if (listSource.length > 0) {
                setHighlightIndex(0);
                focusListItem(0);
            }
            return;
        }

        // For other keys: if open but nothing highlighted yet -> focus first item
        if (listSource.length > 0 && highlightIndex === null) {
            setHighlightIndex(0);
            focusListItem(0);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                !dropdownContentRef.current?.contains(event.target as Node) &&
                !buttonContainerRef.current?.contains(event.target as Node)
            ) closeDropdown();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);


    return (
        <div className={`${styles.dropButtonWrapper} ${className}`}>

            <div
                ref={buttonContainerRef}
                className={styles.dropButton}
                role="button"
                tabIndex={0}
                onDoubleClick={toggleDropdown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={menuId}
            >
                <input
                    ref={inputRef}
                    className={styles.overlayInput}
                    placeholder="Список задач..."
                    value={headerInput}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                />
                <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={handleClear}
                >
                    X
                </button>
            </div>

            {isOpen && (
                <div
                    id={menuId}
                    ref={dropdownContentRef}
                    className={styles.dropdownContent}
                    role="listbox"
                    tabIndex={-1}
                    onKeyDown={handleTaskListKeyDown}
                >
                    {tasks.length === 0 ? (
                        <div className={styles.empty}>Loading…</div>
                    ) : (
                        <ul>
                            {listSource.map((task: ParsedTask, index: number) => (
                                <li
                                    key={task.id}
                                    role="option"
                                    tabIndex={0}
                                    className={styles.dropdownContentli}
                                    title={task.title}
                                    onClick={() => handleSelectTask(task)}
                                    onMouseEnter={() => setHighlightIndex(index)}
                                    onMouseLeave={() => setHighlightIndex(null)}
                                >
                                    {task.no}. {task.title}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

        </div>
    );
}