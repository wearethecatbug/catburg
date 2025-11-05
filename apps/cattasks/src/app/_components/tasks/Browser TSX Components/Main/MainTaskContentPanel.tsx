'use client';
import React, {useEffect, useRef, useState} from 'react';
import styles from './MainTaskContentPanel.module.css';
import {useTaskContext} from '../../Context/TaskProvider';
import MainBtnShowSolution from './MainBtnShowSolution';
import MainBtnShowDescription from './MainBtnShowDescription';
import MainTaskSolutionEditor from '@/app/_components/tasks/Browser TSX Components/Main/MainTaskSolutionEditor';
import MainBtnInfo from '@/app/_components/tasks/Browser TSX Components/Main/MainBtnInfo';

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

    const descriptionText = selectedTask?.description ?? 'Нет описания';
    const solutionText =
        editorSolution && editorSolution.trim().length > 0
            ? editorSolution
            : (selectedTask?.solution ?? '');


    const [activeTab, setActiveTab] = useState<'description' | 'solution' | 'info'>(
        showSolution ? 'solution' : 'description'
    );

    const monacoEditorRef =
        useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
    const taskAreaRef = useRef<HTMLDivElement | null>(null);

    const [localSolutionText, setLocalSolutionText] =
        useState<string>(() => sanitizeSolutionText(solutionText));

    function sanitizeSolutionText(input: string): string {
        return input
            .replace(/[\u00A0\u2007\u202F]/g, ' ')
            .replace(/\r\n?/g, '\n');
    }

    // Синхронизация старого флага showSolution с активной вкладкой
    useEffect(() => {
        setShowSolution?.(activeTab === 'solution');
        if (activeTab === 'solution') {
            requestAnimationFrame(() => monacoEditorRef.current?.layout());
        }
    }, [activeTab, setShowSolution]);

    // Обновление локального текста решения при смене исходных данных
    useEffect(() => {
        setLocalSolutionText(sanitizeSolutionText(solutionText));
    }, [solutionText]);

    // Автолэйаут Monaco при ресайзе контейнера
    useEffect(() => {
        if (!taskAreaRef.current) return;
        const ro = new ResizeObserver(() => monacoEditorRef.current?.layout());
        ro.observe(taskAreaRef.current);
        return () => ro.disconnect();
    }, []);

    const handleToggleMinimize = () => {
        if (!isTaskSelected) return;
        setIsMinimized(prev => !prev);
    };

    const handleShowDescription = () => {
        if (!isTaskSelected) return;
        setActiveTab('description');
    };

    const handleShowSolution = () => {
        if (!isTaskSelected) return;
        setActiveTab('solution');
    };

    const handleShowInfo = () => {
        if (!isTaskSelected) return;
        setActiveTab('info');
    };

    return (
        <div className={`${styles.root} ${isMinimized ? styles.min : ''} ${className ?? ''}`} {...rest}>
            <button
                type="button"
                onClick={handleToggleMinimize}
                disabled={!isTaskSelected}
                aria-disabled={!isTaskSelected}
                aria-expanded={isTaskSelected ? !isMinimized : false}
                className={`${styles.buttonMinimizeBase} ${isMinimized ? styles.buttonMinimizeActive : styles.buttonMinimizeInactive}`}
                aria-label={isMinimized ? 'Показать панель' : 'Свернуть панель'}
            />

            <div className={styles.taskDetailsContainer} aria-hidden={isMinimized}>
                <div className={styles.capibaraBackground} aria-hidden/>

                <div className={`${styles.mainButtonsRow} ${styles.btnContainer}`} role="group"
                     aria-label="Режим содержимого">
                    <MainBtnShowDescription
                        isActive={activeTab === 'description'}
                        isDisabled={!isTaskSelected}
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

                <div ref={taskAreaRef} className={styles.contentContainerBase}>
                    {activeTab === 'solution' && (
                        <div className={`${styles.contentContainerFrame} ${styles.taskSolutionContainer}`}>
                            <div className={styles.editorHost}>
                                <MainTaskSolutionEditor
                                    value={localSolutionText}
                                    onChange={setLocalSolutionText}
                                    onMount={(editor) => {
                                        monacoEditorRef.current = editor;
                                        editor.getAction('editor.action.formatDocument')?.run();
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'description' && (
                        <div className={`${styles.contentContainerFrame} ${styles.taskDescriptionContainer}`}>
                            <pre
                                className={styles.taskDescriptionPre}
                                aria-label={isTaskSelected ? 'Описание задачи' : 'Нет выбранной задачи'}
                            >
      {descriptionText}
    </pre>
                        </div>
                    )}

                    {activeTab === 'info' && (
                        <div className={`${styles.contentContainerFrame} ${styles.taskInfoContainer}`}>
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
        </div>
    );
}