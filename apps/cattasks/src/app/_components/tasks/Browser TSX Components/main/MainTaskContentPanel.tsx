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
        selectedWorkspace,
    } = useTaskContext();

    const isTaskSelected = Boolean(selectedTask);

    const descriptionText = selectedTask?.description ?? 'No task selected.';
    const solutionText = selectedTask?.solution ?? '';

    const monacoEditorRef =
        useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
    const taskAreaRef = useRef<HTMLDivElement | null>(null);
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
        if (activeContentTab === 'solution') {
            requestAnimationFrame(() => monacoEditorRef.current?.layout());
        }
    }, [activeContentTab]);

    useEffect(() => {
        if (!taskAreaRef.current) return;
        const ro = new ResizeObserver(() => monacoEditorRef.current?.layout());
        ro.observe(taskAreaRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (isMinimized) minimizeButtonRef.current?.focus();
        else requestAnimationFrame(() => monacoEditorRef.current?.layout());
    }, [isMinimized]);

    const handleToggleMinimize = () => {
        // if (!isTaskSelected) return;
        setIsMinimized(prev => !prev);
    };

    const handleShowDescription = () => {
        // if (!isTaskSelected) return;
        selectContentTab('description');
    };
    const handleShowSolution = () => {
        if (!isTaskSelected) return;
        selectContentTab('solution');
    };
    const handleShowInfo = () => {
        // if (!isTaskSelected) return;
        selectContentTab('info');
    };

    return (
        <div className={combineClassNames(styles.root, isMinimized && styles.min, className)} {...rest}>
            <div className={styles.taskDetailsContainer}>
                {/* ряд с кнопками — только в развернутом состоянии */}
                {!isMinimized && (
                    <div className={combineClassNames(styles.mainButtonsRow, styles.btnContainer)}
                         role="group" aria-label="Режим содержимого">
                        <button
                            ref={minimizeButtonRef}
                            type="button"
                            onClick={handleToggleMinimize}
                            aria-expanded={!isMinimized}
                            aria-controls="taskPanelContent"
                            className={combineClassNames(
                                styles.buttonMinimizeBase,
                                styles.buttonMinimizeInline,
                                styles.buttonMinimizeInactive
                            )}
                            aria-label="Свернуть панель"
                        />

                        <div className={styles.toolsGroup}>
                            <MainBtnShowDescription
                                isActive={activeContentTab === 'description'}
                                onClick={handleShowDescription}
                                ariaLabel={activeContentTab === 'description' ? 'Показано описание' : 'Показать описание'}
                                className={styles.mainBtnTask}
                            />
                            <MainBtnShowSolution
                                isActive={activeContentTab === 'solution'}
                                isDisabled={!isTaskSelected}
                                onClick={handleShowSolution}
                                ariaLabel={activeContentTab === 'solution' ? 'Показано решение' : 'Показать решение'}
                                className={styles.mainBtnSolution}
                            />
                            <MainBtnInfo
                                isActive={activeContentTab === 'info'}
                                isDisabled={!isTaskSelected}
                                onClick={handleShowInfo}
                                ariaLabel={activeContentTab === 'info' ? 'Показана информация' : 'Показать информацию'}
                                className={styles.mainBtnInfo}
                            />
                        </div>
                    </div>
                )}

                {/* контент — остаётся в DOM, но убирается из потока в .min */}
                <div
                    id="taskPanelContent"
                    ref={taskAreaRef}
                    className={styles.contentContainerBase}
                    aria-hidden={isMinimized}
                    inert={isMinimized}
                >
                    {activeContentTab === 'solution' && (
                        <div className={combineClassNames(styles.contentContainerFrame, styles.taskSolutionContainer)}>
                            <div className={styles.editorHost}>
                                <MainTaskSolutionEditor
                                    value={sanitizeSolutionText(solutionText)}
                                    onMountAction={(editor) => {
                                        monacoEditorRef.current = editor;
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {activeContentTab === 'description' && (
                        <div
                            className={combineClassNames(styles.contentContainerFrame, styles.taskDescriptionContainer)}>
              <pre
                  ref={taskDescriptionPreElementRef}
                  tabIndex={-1}
                  className={styles.taskDescriptionPre}
                  aria-label={isTaskSelected ? 'Описание задачи' : 'Нет выбранной задачи'}
              >
                {descriptionText}
              </pre>
                        </div>
                    )}

                    {activeContentTab === 'info' && (
                        <div className={combineClassNames(styles.contentContainerFrame, styles.taskInfoContainer)}>
              <pre
                  className={styles.taskInfoPre}
                  aria-label={isTaskSelected ? 'Информация о тесте' : 'Нет тестов'}
              >
                {selectedWorkspace?.result?.result.message ?? 'No additional information.'}
              </pre>
                        </div>
                    )}
                </div>
            </div>

            {/* плавающая кнопка — только в свернутом состоянии */}
            {isMinimized && (
                <button
                    ref={minimizeButtonRef}
                    type="button"
                    onClick={handleToggleMinimize}
                    aria-expanded={!isMinimized}
                    aria-controls="taskPanelContent"
                    className={combineClassNames(
                        styles.buttonMinimizeBase,
                        styles.buttonMinimizeFloating,
                        styles.buttonMinimizeActive
                    )}
                    aria-label="Показать панель"
                />
            )}
        </div>
    );
}
