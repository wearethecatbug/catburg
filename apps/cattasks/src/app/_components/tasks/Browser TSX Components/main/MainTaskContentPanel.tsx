'use client';
import React, {useEffect, useRef, useState} from 'react';
import styles from './MainTaskContentPanel.module.css';
import {useTaskContext} from '../../context/TaskProvider';
import MainBtnShowSolution from './MainBtnShowSolution';
import MainBtnShowDescription from './MainBtnShowDescription';
import MainTaskSolutionEditor from '@/app/_components/tasks/Browser TSX Components/main/MainTaskSolutionEditor';
import MainBtnInfo from '@/app/_components/tasks/Browser TSX Components/main/MainBtnInfo';
import {combineClassNames} from '@/app/_components/tasks/shared/utils/combineClassNames';

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function MainTaskContentPanel({className, ...rest}: Props) {
    const [isMinimized, setIsMinimized] = useState(false);

    const {
        selectedTask,
        activeContentTab,
        selectContentTab,
    } = useTaskContext();

    const isTaskSelected = Boolean(selectedTask);

    const descriptionText = selectedTask?.description ?? 'No task selected.';
    const solutions = selectedTask?.solutions ?? [];
    const hints = selectedTask?.hints ?? [];

    const minimizeButtonRef = useRef<HTMLButtonElement | null>(null);

    const taskDescriptionPreElementRef =
        useRef<HTMLPreElement | null>(null);

    function sanitizeSolutionText(input: string): string {
        return input.replace(/[\u00A0\u2007\u202F]/g, ' ').replace(/\r\n?/g, '\n');
    }

    useEffect(() => {
        if (!selectedTask) {
            return;
        }

        // После отрисовки переносим фокус на описание
        requestAnimationFrame(() => {
            const taskDescriptionElement = taskDescriptionPreElementRef.current;
            if (taskDescriptionElement) {
                taskDescriptionElement.focus();
            }
        });
    }, [selectedTask?.id]);

    useEffect(() => {
        if (isMinimized) minimizeButtonRef.current?.focus();
    }, [isMinimized]);

    const handleToggleMinimize = () => {
        setIsMinimized(prev => !prev);
    };

    const handleShowDescription = () => {
        selectContentTab('description');
    };
    const handleShowSolution = () => {
        if (!isTaskSelected) return;
        selectContentTab('solution');
    };
    const handleShowInfo = () => {
        selectContentTab('hint');
    };

    return (
        <div className={combineClassNames(styles.root, isMinimized && styles.min, className)} {...rest}>
            <div className={styles.taskDetailsContainer}>
                <button
                    ref={minimizeButtonRef}
                    type="button"
                    onClick={handleToggleMinimize}
                    aria-expanded={!isMinimized}
                    aria-controls="taskPanelContent"
                    className={styles.buttonMinimizeBase}
                    aria-label={isMinimized ? 'Show task: Показать панель' : 'Hide task: Свернуть панель'}
                >
                    <span>{isMinimized ? 'Show task' : 'Hide task'}</span>
                </button>

                {!isMinimized && (
                    <div className={combineClassNames(styles.mainButtonsRow, styles.btnContainer)}
                         role="group" aria-label="Режим содержимого">
                        <MainBtnShowDescription
                            isActive={activeContentTab === 'description'}
                            onClick={handleShowDescription}
                            ariaLabel={activeContentTab === 'description' ? 'Показано описание' : 'Показать описание'}
                            className={styles.mainBtnTask}
                        />
                        <MainBtnInfo
                            isActive={activeContentTab === 'hint'}
                            isDisabled={!isTaskSelected}
                            onClick={handleShowInfo}
                            ariaLabel={activeContentTab === 'hint' ? 'Показаны подсказки' : 'Показать подсказки'}
                            className={styles.mainBtnInfo}
                        />
                    </div>
                )}

                {/* контент — остаётся в DOM, но убирается из потока в .min */}
                <div
                    id="taskPanelContent"
                    className={styles.contentContainerBase}
                    aria-hidden={isMinimized}
                    inert={isMinimized}
                >
                    {activeContentTab === 'solution' && (
                        <div className={combineClassNames(styles.contentContainerFrame, styles.taskSolutionContainer)}>
                            <div className={styles.editorHost}>
                                {solutions.length ? (
                                    solutions.map(solution => <MainTaskSolutionEditor key={solution.id} value={sanitizeSolutionText(solution.code)} solution={solution}/>)
                                ) : (
                                    <MainTaskSolutionEditor value={sanitizeSolutionText(selectedTask?.solution ?? '')}/>
                                )}
                            </div>
                        </div>
                    )}

                    {activeContentTab === 'description' && (
                        <div
                            className={combineClassNames(styles.contentContainerFrame, styles.taskDescriptionContainer)}>
                            <div className={styles.descriptionBody}>
                                <h2 className={styles.challengeHeading}>The challenge</h2>
                                <pre
                                    ref={taskDescriptionPreElementRef}
                                    tabIndex={-1}
                                    className={styles.taskDescriptionPre}
                                    aria-label={isTaskSelected ? 'Описание задачи' : 'Нет выбранной задачи'}
                                >
                                    {descriptionText}
                                </pre>
                            </div>
                        </div>
                    )}

                    {activeContentTab === 'hint' && (
                        <div className={combineClassNames(styles.contentContainerFrame, styles.taskInfoContainer)}>
                            <div key={selectedTask?.id} className={styles.hintPanel}>
                                <div className={styles.hintHeading}>
                                    <h2>Hints for this task</h2>
                                    <span>{hints.length} available</span>
                                </div>
                                {hints.length ? (
                                    <div className={styles.hintList}>
                                        {hints.map((hint, index) => (
                                            <details key={index} className={styles.hint}>
                                                <summary>Hint {index + 1}</summary>
                                                <p>{hint}</p>
                                            </details>
                                        ))}
                                    </div>
                                ) : <p className={styles.noHints}>No hint available for this task.</p>}
                            </div>
                        </div>
                    )}
                </div>
                {!isMinimized && (
                    <MainBtnShowSolution
                        isActive={activeContentTab === 'solution'}
                        isDisabled={!isTaskSelected}
                        onClick={handleShowSolution}
                        ariaLabel={activeContentTab === 'solution' ? 'Показано решение' : 'Показать решение'}
                        className={styles.mainBtnSolution}
                    />
                )}
            </div>
        </div>
    );
}
