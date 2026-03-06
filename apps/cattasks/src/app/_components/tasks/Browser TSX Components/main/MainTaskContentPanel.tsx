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
        editorSolution,
        showSolution,
        setShowSolution,
        testNotificationText,
    } = useTaskContext();

    const isTaskSelected = Boolean(selectedTask);

    const descriptionText = selectedTask?.description ?? 'No task selected.';
    const solutionText =
        editorSolution && editorSolution.trim().length > 0
            ? editorSolution
            : (selectedTask?.solution ?? '');

    const [activeTab, setActiveTab] =
        useState<'description' | 'solution' | 'info'>(showSolution ? 'solution' : 'description');

    const monacoEditorRef =
        useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
    const taskAreaRef = useRef<HTMLDivElement | null>(null);
    const minimizeButtonRef = useRef<HTMLButtonElement | null>(null);

    const [localSolutionText, setLocalSolutionText] =
        useState<string>(() => sanitizeSolutionText(solutionText));

    const taskDescriptionPreElementRef =
        useRef<HTMLPreElement | null>(null);

    function sanitizeSolutionText(input: string): string {
        return input.replace(/[\u00A0\u2007\u202F]/g, ' ').replace(/\r\n?/g, '\n');
    }

    useEffect(() => {
        if (!selectedTask) {
            return;
        }

        // Всегда переключаемся на вкладку описания
        setActiveTab('description');

        // После отрисовки переносим фокус на описание
        requestAnimationFrame(() => {
            const taskDescriptionElement = taskDescriptionPreElementRef.current;
            if (taskDescriptionElement) {
                taskDescriptionElement.focus();
            }
        });
    }, [selectedTask?.id]);

    useEffect(() => {
        setShowSolution?.(activeTab === 'solution');
        if (activeTab === 'solution') {
            requestAnimationFrame(() => monacoEditorRef.current?.layout());
        }
    }, [activeTab, setShowSolution]);

    useEffect(() => {
        setLocalSolutionText(sanitizeSolutionText(solutionText));
    }, [solutionText]);

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
        setActiveTab('description');
    };
    const handleShowSolution = () => {
        if (!isTaskSelected) return;
        setActiveTab('solution');
    };
    const handleShowInfo = () => {
        // if (!isTaskSelected) return;
        setActiveTab('info');
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
                                isActive={activeTab === 'description'}
                                onClick={handleShowDescription}
                                ariaLabel={activeTab === 'description' ? 'Показано описание' : 'Показать описание'}
                                className={styles.mainBtnTask}
                            />
                            <MainBtnShowSolution
                                isActive={activeTab === 'solution'}
                                isDisabled={!isTaskSelected}
                                onClick={handleShowSolution}
                                ariaLabel={activeTab === 'solution' ? 'Показано решение' : 'Показать решение'}
                                className={styles.mainBtnSolution}
                            />
                            <MainBtnInfo
                                isActive={activeTab === 'info'}
                                isDisabled={!isTaskSelected}
                                onClick={handleShowInfo}
                                ariaLabel={activeTab === 'info' ? 'Показана информация' : 'Показать информацию'}
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
                    {activeTab === 'solution' && (
                        <div className={combineClassNames(styles.contentContainerFrame, styles.taskSolutionContainer)}>
                            <div className={styles.editorHost}>
                                <MainTaskSolutionEditor
                                    value={localSolutionText}
                                    onChangeAction={setLocalSolutionText}
                                    onMountAction={(editor) => {
                                        monacoEditorRef.current = editor;
                                        editor.getAction('editor.action.formatDocument')?.run();
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'description' && (
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

                    {activeTab === 'info' && (
                        <div className={combineClassNames(styles.contentContainerFrame, styles.taskInfoContainer)}>
              <pre
                  className={styles.taskInfoPre}
                  aria-label={isTaskSelected ? 'Информация о тесте' : 'Нет тестов'}
              >
                {testNotificationText}
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