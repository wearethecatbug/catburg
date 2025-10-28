'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState,} from 'react';
import type {ParsedTask} from '../lib/ParseTasksArr';
import {useTasksArr} from '../Hooks/UseTasks';

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

    selectPreviousTask: () => void;
    selectNextTask: () => void;

    editorSolution: string;
    setEditorSolution: (v: string) => void;

    editorUserCode: string;
    setEditorUserCode: (v: string) => void;
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

    // синхронизация задач из источника
    useEffect(() => {
        setTasks(sourceTasks);
    }, [sourceTasks]);

    const selectedTask = useMemo<ParsedTask | null>(() => {
        if (!selectedId) return null;
        return tasks.find(t => t.id === selectedId) ?? null;
    }, [tasks, selectedId]);

    // единая точка смены задачи
    const selectTask = useCallback((id: string) => {
        if (id === selectedId) return;

        setSelectedId(id);

        const task = tasks.find(t => t.id === id);
        if (task) setHeaderInput(`${task.no}. ${task.title}`);

        setShowSolution(false);
        setRunTest(false);
        setValidSolution(false);
        setEditorUserCode('');
        setEditorSolution('No solution available.');
    }, [tasks, selectedId]);

    // навигация стрелками
    const selectPreviousTask = useCallback(() => {
        if (tasks.length === 0) return;
        const currentIndex = selectedId ? tasks.findIndex(t => t.id === selectedId) : -1;
        const previousIndex = modulo((currentIndex === -1 ? tasks.length - 1 : currentIndex - 1), tasks.length);
        selectTask(tasks[previousIndex].id);
    }, [tasks, selectedId, selectTask]);

    const selectNextTask = useCallback(() => {
        if (tasks.length === 0) return;
        const currentIndex = selectedId ? tasks.findIndex(t => t.id === selectedId) : -1;
        const nextIndex = modulo(currentIndex + 1, tasks.length);
        selectTask(tasks[nextIndex].id);
    }, [tasks, selectedId, selectTask]);

    // показать/скрыть решение с подстановкой текста
    const toggleShowSolution = useCallback((next?: boolean) => {
        setShowSolution(prev => {
            const newValue = next ?? !prev;
            if (newValue) {
                setEditorSolution(selectedTask?.solution ?? 'No solution available.');
            } else {
                setEditorSolution('No solution available.');
            }
            return newValue;
        });
    }, [selectedTask?.solution]);

    // если решение обновилось при открытой панели — синхронизировать
    useEffect(() => {
        if (showSolution) {
            setEditorSolution(selectedTask?.solution ?? 'No solution available.');
        }
    }, [showSolution, selectedTask?.solution]);

    // первичная инициализация выбора
    useEffect(() => {
        if (!selectedId && tasks.length > 0) {
            const first = tasks[0];
            setSelectedId(first.id);
            setHeaderInput(`${first.no}. ${first.title}`);
            setShowSolution(false);
            setEditorSolution('No solution available.');
        }
    }, [tasks, selectedId]);

    const updateTask = useCallback((id: string, patch: Partial<ParsedTask>) => {
        setTasks(prev => prev.map(t => (t.id === id ? {...t, ...patch} : t)));
    }, []);

    const setTaskSolution = useCallback((id: string, solution: string) => {
        updateTask(id, {solution});
        if (id === selectedId && showSolution) {
            setEditorSolution(solution || 'No solution available.');
        }
    }, [updateTask, selectedId, showSolution]);

    const clearSelectedFields = useCallback(() => {
        setHeaderInput('');
        setSelectedId(null);
        setShowSolution(false);
        setRunTest(false);
        setValidSolution(false);
        setEditorSolution('No solution available.');
        setEditorUserCode('');
    }, []);

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
    };

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext() {
    const ctx = useContext(TaskContext);
    if (!ctx) throw new Error('useTaskContext must be used inside TaskProvider');
    return ctx;
}