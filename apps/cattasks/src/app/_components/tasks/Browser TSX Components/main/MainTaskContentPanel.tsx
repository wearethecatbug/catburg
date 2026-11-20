'use client';
import React, {useEffect, useRef, useState} from 'react';
import styles from './MainTaskContentPanel.module.css';
import {useTaskContext} from '../../context/TaskProvider';
import MainBtnShowSolution from './MainBtnShowSolution';
import MainBtnShowDescription from './MainBtnShowDescription';
import MainTaskSolutionEditor from '@/app/_components/tasks/Browser TSX Components/main/MainTaskSolutionEditor';
import MainBtnInfo from '@/app/_components/tasks/Browser TSX Components/main/MainBtnInfo';
import {combineClassNames} from '@/app/_components/tasks/shared/utils/combineClassNames';
import CollapsedTaskSpine from './CollapsedTaskSpine';
import MainTaskSavedSolution from './MainTaskSavedSolution';
import {isWarhammerTheme, useCatTasksTheme} from '../taskDashboard/CatTasksTheme';

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function MainTaskContentPanel({className, ...rest}: Props) {
    const [isMinimized, setIsMinimized] = useState(false);
    const {theme} = useCatTasksTheme();

    const {
        selectedTask,
        selectedWorkspace,
        activeContentTab,
        selectContentTab,
        setSelectedDraft,
    } = useTaskContext();

    const isTaskSelected = Boolean(selectedTask);
    const useKhorneTabs = isWarhammerTheme(theme);
    // The reference solution is opened by the existing Give up action, not by a
    // separate tab. Keep that action/state intact while exposing its containing
    // Task tab as the active tab to assistive technology.
    const khorneSelectedTab = activeContentTab === 'solution' ? 'description' : activeContentTab;

    const descriptionText = selectedTask?.description ?? 'No task selected.';
    const solutions = selectedTask?.solutions ?? [];
    const hints = selectedTask?.hints ?? [];

    const minimizeButtonRef = useRef<HTMLButtonElement | null>(null);
    const shouldRestoreToggleFocus = useRef(false);

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
        if (!shouldRestoreToggleFocus.current) return;

        minimizeButtonRef.current?.focus();
        shouldRestoreToggleFocus.current = false;
    }, [isMinimized]);

    const handleToggleMinimize = () => {
        shouldRestoreToggleFocus.current = true;
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
    const handleShowMySolution = () => {
        if (!isTaskSelected) return;
        selectContentTab('mySolution');
    };

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []);
        const currentIndex = tabs.indexOf(event.currentTarget);
        if (currentIndex < 0) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? tabs.length - 1
                : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[nextIndex]?.focus();
        const nextTab = tabs[nextIndex]?.dataset.contentTab;
        if (nextTab === 'description' || nextTab === 'hint' || nextTab === 'mySolution') selectContentTab(nextTab);
    };

    return (
        <div
            className={combineClassNames(styles.root, isMinimized && styles.min, className)}
            data-task-collapsed={isMinimized || undefined}
            {...rest}
        >
            <div className={styles.taskDetailsContainer}>
                {isMinimized ? (
                    <CollapsedTaskSpine
                        ref={minimizeButtonRef}
                        controlsId="taskPanelContent"
                        onExpand={handleToggleMinimize}
                        className={styles.collapsedTaskSpine}
                    />
                ) : null}

                {!isMinimized && (
                    <div className={combineClassNames(styles.mainButtonsRow, styles.btnContainer, useKhorneTabs && styles.khorneTabBar)}
                         role={useKhorneTabs ? undefined : 'group'} aria-label="Режим содержимого">
                        {useKhorneTabs ? (
                            <div className={styles.khorneTabs} role="tablist" aria-label="Task panel">
                                <button id="task-tab-description" role="tab" type="button" data-content-tab="description" tabIndex={khorneSelectedTab === 'description' ? 0 : -1} aria-selected={khorneSelectedTab === 'description'} aria-controls="taskPanelContent" className={styles.khorneTab} onClick={handleShowDescription} onKeyDown={handleTabKeyDown}>Task</button>
                                <button id="task-tab-hint" role="tab" type="button" data-content-tab="hint" tabIndex={khorneSelectedTab === 'hint' ? 0 : -1} aria-selected={khorneSelectedTab === 'hint'} aria-controls="taskPanelContent" className={styles.khorneTab} disabled={!isTaskSelected} onClick={handleShowInfo} onKeyDown={handleTabKeyDown}>Hint</button>
                                <button id="task-tab-my-solution" role="tab" type="button" data-content-tab="mySolution" tabIndex={khorneSelectedTab === 'mySolution' ? 0 : -1} aria-selected={khorneSelectedTab === 'mySolution'} aria-controls="taskPanelContent" className={styles.khorneTab} disabled={!isTaskSelected} onClick={handleShowMySolution} onKeyDown={handleTabKeyDown}>My solution</button>
                            </div>
                        ) : <>
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
                        <button
                            type="button"
                            className={styles.mainBtnMySolution}
                            onClick={handleShowMySolution}
                            disabled={!isTaskSelected}
                            aria-disabled={!isTaskSelected}
                            aria-pressed={activeContentTab === 'mySolution'}
                        >
                            <span>My solution</span>
                        </button>
                        </>}
                        <button
                            ref={minimizeButtonRef}
                            type="button"
                            onClick={handleToggleMinimize}
                            aria-expanded={true}
                            aria-controls="taskPanelContent"
                            className={styles.buttonMinimizeBase}
                            aria-label={useKhorneTabs ? 'Hide task' : 'Hide task: Свернуть панель'}
                        >
                            <span>Hide task</span>
                        </button>
                    </div>
                )}

                {/* контент — остаётся в DOM, но убирается из потока в .min */}
                <div
                    id="taskPanelContent"
                    className={styles.contentContainerBase}
                    role={useKhorneTabs ? 'tabpanel' : undefined}
                    aria-labelledby={useKhorneTabs ? `task-tab-${khorneSelectedTab === 'mySolution' ? 'my-solution' : khorneSelectedTab}` : undefined}
                    tabIndex={useKhorneTabs ? 0 : undefined}
                    aria-hidden={isMinimized}
                    inert={isMinimized}
                >
                    {activeContentTab === 'solution' && (
                        <div className={combineClassNames(styles.contentContainerFrame, styles.taskSolutionContainer)} role={useKhorneTabs ? 'region' : undefined} aria-label={useKhorneTabs ? 'Reference solution' : undefined}>
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

                    {activeContentTab === 'mySolution' && selectedTask && selectedWorkspace && (
                        <MainTaskSavedSolution
                            key={selectedTask.id}
                            taskId={selectedTask.id}
                            draft={selectedWorkspace.draft}
                            onRestore={setSelectedDraft}
                        />
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
