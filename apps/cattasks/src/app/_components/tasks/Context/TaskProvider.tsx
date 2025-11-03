'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState,} from 'react';
import type {ParsedTask} from '../lib/ParseTasksArr';
import {useTasksArr} from '../Hooks/UseTasks';

type TestResultDetail = { resultText: string; areAllTestsPassed: boolean };
type ContentTab = 'description' | 'solution' | 'info';

type TaskContextValue = {
    tasks: ParsedTask[];
    selectedId: string | null;
    selectedTask: ParsedTask | null;

    setSelectedId: (id: string | null) => void;
    selectTask: (id: string) => void;

    headerInput: string;
    setHeaderInput: (v: string) => void;

    updateTask: (id: string, patch: Partial<ParsedTask>) => void;
    clearSelectedFields: () => void;
    setTaskSolution: (id: string, solution: string) => void;

    showSolution: boolean;
    setShowSolution: (v: boolean) => void;
    toggleShowSolution: (next?: boolean) => void;

    runTest: boolean;
    setRunTest: (v: boolean) => void;

    validSolution: boolean;
    setValidSolution: (v: boolean) => void;

    activeContentTab: ContentTab;
    setActiveContentTab: (v: ContentTab) => void;

    isMainPanelMinimized: boolean;
    setMainPanelMinimized: (v: boolean) => void;

    selectPreviousTask: () => void;
    selectNextTask: () => void;

    editorSolution: string;
    setEditorSolution: (v: string) => void;

    editorUserCode: string;
    setEditorUserCode: (v: string) => void;

    testNotificationText: string;
    setTestNotificationText: (v: string) => void;

    setEditorUserCodeAndReset: (next: string) => void;
};

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

// модуль с корректной работой на отрицательных значениях
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

export function TaskProvider({children}: { children: React.ReactNode }) {
    const sourceTasks = useTasksArr() ?? [];

    const [tasks, setTasks] = useState<ParsedTask[]>(sourceTasks);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [headerInput, setHeaderInput] = useState<string>('');

    const [showSolution, setShowSolution] = useState<boolean>(false);
    const [runTest, setRunTest] = useState<boolean>(false);
    const [validSolution, setValidSolution] = useState<boolean>(false);

    const [editorSolution, setEditorSolution] = useState<string>('No solution available.');
    const [editorUserCode, setEditorUserCode] = useState<string>('');

    const defaultSolutionText = 'No solution available.';
    const defaultTestInfoText = 'Нет дополнительной информации';

    const [activeContentTab, setActiveContentTab] = useState<ContentTab>('description');
    const [isMainPanelMinimized, setMainPanelMinimized] = useState<boolean>(false);

    const updateTask = useCallback((id: string, patch: Partial<ParsedTask>) => {
        setTasks(prevTasks => prevTasks.map(task => (task.id === id ? {...task, ...patch} : task)));
    }, []);

    const [testNotificationText, setTestNotificationText] =
        useState<string>(defaultTestInfoText);

    // синхронизация задач из источника
    useEffect(() => {
        setTasks(sourceTasks);
    }, [sourceTasks]);

    const selectedTask = useMemo<ParsedTask | null>(() => {
        if (!selectedId) return null;
        return tasks.find(t => t.id === selectedId) ?? null;
    }, [tasks, selectedId]);

    // единая точка смены задачи
    const selectTask = useCallback(
        (id: string) => {
            if (id === selectedId) return;
            setSelectedId(id);

            const task = tasks.find(t => t.id === id);
            if (task) setHeaderInput(`${task.no}. ${task.title}`);

            setActiveContentTab('description');
            setShowSolution(false);
            setRunTest(false);
            setValidSolution(false);
            setEditorUserCode('');
            setEditorSolution(defaultSolutionText);
            setTestNotificationText(defaultTestInfoText);
        },
        [tasks, selectedId, defaultSolutionText, defaultTestInfoText]
    );

    // производить showSolution из вкладки
    useEffect(() => {
        const isSolution = activeContentTab === 'solution';
        setShowSolution(isSolution);
        if (isSolution) {
            setEditorSolution(selectedTask?.solution ?? defaultSolutionText);
        }
    }, [activeContentTab, selectedTask?.solution, defaultSolutionText]);

    // навигация стрелками
    const selectPreviousTask = useCallback(() => {
        if (tasks.length === 0) return;
        const currentIndex = selectedId ? tasks.findIndex(t => t.id === selectedId) : -1;
        const previousIndex = modulo(currentIndex === -1 ? tasks.length - 1 : currentIndex - 1, tasks.length);
        selectTask(tasks[previousIndex].id);
    }, [tasks, selectedId, selectTask]);

    const selectNextTask = useCallback(() => {
        if (tasks.length === 0) return;
        const currentIndex = selectedId ? tasks.findIndex(t => t.id === selectedId) : -1;
        const nextIndex = modulo(currentIndex + 1, tasks.length);
        selectTask(tasks[nextIndex].id);
    }, [tasks, selectedId, selectTask]);

    // показать/скрыть решение с подстановкой текста
    const toggleShowSolution = useCallback(
        (next?: boolean) => {
            setShowSolution(prev => {
                const newValue = next ?? !prev;
                if (newValue) {
                    setEditorSolution(selectedTask?.solution ?? defaultSolutionText);
                } else {
                    setEditorSolution(defaultSolutionText);
                }
                return newValue;
            });
        },
        [selectedTask?.solution, defaultSolutionText]
    );

    // если решение обновилось при открытой панели — синхронизировать
    useEffect(() => {
        if (showSolution) {
            setEditorSolution(selectedTask?.solution ?? defaultSolutionText);
        }
    }, [showSolution, selectedTask?.solution, defaultSolutionText]);

    // первичная инициализация выбора
    useEffect(() => {
        if (!selectedId && tasks.length > 0) {
            const first = tasks[0];
            setSelectedId(first.id);
            setHeaderInput(`${first.no}. ${first.title}`);
            setShowSolution(false);
            setEditorSolution(defaultSolutionText);
        }
    }, [tasks, selectedId, defaultSolutionText]);

    // единый обработчик результатов тестов
    useEffect(() => {
        const handle = (event: Event) => {
            const {detail} = event as CustomEvent<TestResultDetail>;
            if (!detail) return;
            setTestNotificationText(detail.resultText);
            setRunTest(true);
            setValidSolution(detail.areAllTestsPassed);
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('capibara:testResult', handle as EventListener);
            return () =>
                window.removeEventListener('capibara:testResult', handle as EventListener);
        }
        return;
    }, []);

    const setTaskSolution = useCallback(
        (id: string, solution: string) => {
            updateTask(id, {solution});
            if (id === selectedId && showSolution) {
                setEditorSolution(solution || defaultSolutionText);
            }
        },
        [updateTask, selectedId, showSolution, defaultSolutionText]
    );

    const setEditorUserCodeAndReset = useCallback((next: string) => {
        setEditorUserCode(next);
        setRunTest(false);
        setValidSolution(false);
        setTestNotificationText(defaultTestInfoText);
    }, [defaultTestInfoText]);

    const clearSelectedFields = useCallback(() => {
        setHeaderInput('');
        setSelectedId(null);
        setShowSolution(false);
        setRunTest(false);
        setValidSolution(false);
        setEditorSolution(defaultSolutionText);
        setEditorUserCode('');
        setTestNotificationText(defaultTestInfoText);
    }, [defaultSolutionText, defaultTestInfoText]);

    const value: TaskContextValue = {
        tasks,
        selectedId,
        selectedTask,

        setSelectedId,
        selectTask,

        headerInput,
        setHeaderInput,

        updateTask,
        clearSelectedFields,
        setTaskSolution,

        showSolution,
        setShowSolution,
        toggleShowSolution,

        runTest,
        setRunTest,

        validSolution,
        setValidSolution,

        selectPreviousTask,
        selectNextTask,

        editorSolution,
        setEditorSolution,

        editorUserCode,
        setEditorUserCode,

        testNotificationText,
        setTestNotificationText,

        setEditorUserCodeAndReset,

        activeContentTab,
        setActiveContentTab,

        isMainPanelMinimized,
        setMainPanelMinimized,
    };

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext() {
    const ctx = useContext(TaskContext);
    if (!ctx) throw new Error('useTaskContext must be used inside TaskProvider');
    return ctx;
}
