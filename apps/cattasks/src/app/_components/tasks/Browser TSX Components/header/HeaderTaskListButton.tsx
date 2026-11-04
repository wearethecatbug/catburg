"use client";
import React, {useEffect, useRef, useState} from "react";
import styles from "./HeaderTaskListButton.module.css";
import type {CatalogTask} from "../../catalog/taskCatalog";
import {useTaskContext} from "../../context/TaskProvider";
import HeaderTaskListDeleteButton from "./HeaderTaskListDeleteButton";

type HeaderTaskListButtonProps = {
    readonly className?: string,
};

export default function HeaderTaskListButton({className = ""}: HeaderTaskListButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const {
        selectedId,
        headerInput,
        setTaskFilter,
        selectTask,
        tasks,
        catalogError,
        retryCatalog,
    } = useTaskContext();

    const dropdownContentRef = useRef<HTMLDivElement>(null);
    const buttonContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [openedByTyping, setOpenedByTyping] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

    const menuId = "headerTaskListMenu";

    const toggleDropdown = () => {
        setOpenedByTyping(false);
        setIsOpen(prev => !prev);
    };

    const normalizedInput = (headerInput ?? "").trim().toLowerCase();
    const filteredTasks = tasks.filter(task =>
        task.title.toLowerCase().includes(normalizedInput) ||
        task.ordinal.toString().includes(normalizedInput) ||
        `${task.ordinal}.`.toLowerCase().includes(normalizedInput),
    );
    const listSource =
        !openedByTyping && isOpen && normalizedInput !== "" ? tasks : normalizedInput ? filteredTasks : tasks;

    const closeDropdown = () => setIsOpen(false);

    // После clearSelection() закрываем список и возвращаем фокус.
    useEffect(() => {
        const cleared = (!selectedId) && ((headerInput ?? "").trim() === "");
        if (cleared) {
            setIsOpen(false);
            inputRef.current?.focus();
        }
    }, [selectedId, headerInput]);

    useEffect(() => {
        if (isOpen && !openedByTyping) dropdownContentRef.current?.focus();
    }, [isOpen, openedByTyping]);

    const focusListItem = (index: number) => {
        requestAnimationFrame(() => {
            const items = dropdownContentRef.current?.querySelectorAll<HTMLLIElement>("li");
            const item = items?.[index];
            if (item) item.focus();
        });
    };

    useEffect(() => {
        if (highlightIndex !== null && (highlightIndex < 0 || highlightIndex >= listSource.length)) {
            setHighlightIndex(null);
        }
    }, [listSource, highlightIndex]);

    const handleSelectTask = (task: CatalogTask) => {
        closeDropdown();
        selectTask(task.id);
        inputRef.current?.focus();
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        setTaskFilter(newValue);

        const trimmed = newValue.trim();
        if (trimmed !== "") {
            const inputLower = trimmed.toLowerCase();
            const matches = tasks.filter(
                task =>
                    task.title.toLowerCase().includes(inputLower) ||
                    task.ordinal.toString().includes(inputLower) ||
                    `${task.ordinal}.`.toLowerCase().includes(inputLower),
            );
            if (matches.length > 0) {
                setOpenedByTyping(true);
                setIsOpen(true);
            }
        } else {
            setIsOpen(false);
        }
    };

    const handleTaskListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeDropdown();
            inputRef.current?.focus();
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const index = highlightIndex;
            if (index !== null) {
                const task = listSource[index];
                if (task) handleSelectTask(task);
            } else {
                const items = dropdownContentRef.current?.querySelectorAll<HTMLLIElement>("li");
                const focused = Array.from(items ?? []).findIndex(li => li === document.activeElement);
                if (focused >= 0) {
                    const task = listSource[focused];
                    if (task) handleSelectTask(task);
                }
            }
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            const next = highlightIndex === null ? 0 : Math.min(highlightIndex + 1, listSource.length - 1);
            setHighlightIndex(next);
            focusListItem(next);
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            const prev = highlightIndex === null ? Math.max(0, listSource.length - 1) : Math.max(highlightIndex - 1, 0);
            setHighlightIndex(prev);
            focusListItem(prev);
            return;
        }
    };

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
        if (event.key === "Enter") {
            event.preventDefault();
            if (highlightIndex !== null) {
                const task = listSource[highlightIndex];
                if (task) handleSelectTask(task);
                return;
            }
            if (listSource.length > 0) {
                setHighlightIndex(0);
                focusListItem(0);
            }
        } else {
            if (listSource.length > 0 && highlightIndex === null) {
                setHighlightIndex(0);
                focusListItem(0);
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = (mouseEvent: MouseEvent) => {
            if (
                isOpen &&
                !dropdownContentRef.current?.contains(mouseEvent.target as Node) &&
                !buttonContainerRef.current?.contains(mouseEvent.target as Node)
            ) {
                closeDropdown();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className={`${styles.dropdownWrapper} ${className}`.trim()}>
            <div
                ref={buttonContainerRef}
                className={styles.dropdownTrigger}
                onDoubleClick={toggleDropdown}
            >
                <input
                    ref={inputRef}
                    className={styles.dropdownInput}
                    placeholder="Список задач..."
                    value={headerInput}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                />

                <HeaderTaskListDeleteButton className={styles.deleteButton}/>
            </div>

            {catalogError && (
                <div role="alert">
                    Не удалось загрузить каталог задач.
                    <button type="button" onClick={retryCatalog}>Повторить</button>
                </div>
            )}

            {isOpen && (
                <div
                    id={menuId}
                    ref={dropdownContentRef}
                    className={styles.dropdownList}
                    role="listbox"
                    tabIndex={-1}
                    onKeyDown={handleTaskListKeyDown}
                >
                    {tasks.length === 0 ? (
                        <div className={styles.taskListEmptyState}>{catalogError ? "Каталог недоступен." : "Loading…"}</div>
                    ) : (
                        <ul>
                            {listSource.map((task: CatalogTask, index: number) => (
                                <li
                                    key={task.id}
                                    role="option"
                                    aria-selected={task.id === selectedId}
                                    tabIndex={0}
                                    className={styles.dropdownListItem}
                                    title={task.title}
                                    onClick={() => handleSelectTask(task)}
                                    onMouseEnter={() => setHighlightIndex(index)}
                                    onMouseLeave={() => setHighlightIndex(null)}
                                >
                                    {task.ordinal}. {task.title}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
