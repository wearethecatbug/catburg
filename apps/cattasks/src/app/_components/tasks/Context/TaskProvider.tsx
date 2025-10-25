'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import type {ParsedTask} from '../lib/ParseTasksArr';
import {useTasksArr} from '../Hooks/UseTasks';

type TaskContextValue = {
    tasks: ParsedTask[];
    selectedId: string | null;
    selectedTask: ParsedTask | null;
    setSelectedId: (id: string | null) => void;
    headerInput: string;
    setHeaderInput: (v: string) => void;
    updateTask: (id: string, patch: Partial<ParsedTask>) => void;
    clearSelectedFields: () => void;
    setTaskSolution: (id: string, solution: string) => void;
    showSolution: boolean;
    setShowSolution: (v: boolean) => void;
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

// modulo that handles negative numbers correctly
const modulo = (value: number, divisor: number) =>
    ((value % divisor) + divisor) % divisor;

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

export function TaskProvider({children}: { children: React.ReactNode }) {
    // source tasks from hook
    const sourceTasks = useTasksArr() ?? [];
    // local state so we can update tasks within the provider
    const [tasks, setTasks] = useState<ParsedTask[]>(sourceTasks);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [headerInput, setHeaderInput] = useState<string>('');
    const [showSolution, setShowSolution] = useState<boolean>(false);
    const [runTest, setRunTest] = useState<boolean>(false);
    const [validSolution, setValidSolution] = useState<boolean>(false);
    const [editorSolution, setEditorSolution] = useState<string>('No solution available.');
    const [editorUserCode, setEditorUserCode] = useState<string>('');

    const findIndexById = (id: string | null): number =>
        id ? tasks.findIndex(t => t.id === id) : -1;

    const selectedTask = useMemo<ParsedTask | null>(() => {
        if (!selectedId) return null;
        return tasks.find(t => t.id === selectedId) ?? null;
    }, [tasks, selectedId]);

    const selectPreviousTask = useCallback(() => {
        if (tasks.length === 0) return;
        setSelectedId(prevId => {
            const currentIndex = prevId ? tasks.findIndex(t => t.id === prevId) : -1;
            const previousIndex = modulo((currentIndex === -1 ? tasks.length - 1 : currentIndex - 1), tasks.length);
            const newTask = tasks[previousIndex];
            setHeaderInput(`${newTask.no}. ${newTask.title}`);
            console.log(currentIndex, previousIndex);
            return tasks[previousIndex].id;
        });
    }, [tasks]);

    const selectNextTask = useCallback(() => {
        if (tasks.length === 0) return;
        setSelectedId(prevId => {
            const currentIndex = prevId ? tasks.findIndex(t => t.id === prevId) : -1;
            const nextIndex = modulo(currentIndex + 1, tasks.length);
            const newTask = tasks[nextIndex];
            setHeaderInput(`${newTask.no}. ${newTask.title}`);
            return tasks[nextIndex].id;
        });
    }, [tasks]);


    // generic update helper
    const updateTask = useCallback((id: string, patch: Partial<ParsedTask>) => {
        setTasks(previous => previous.map(t => (t.id === id ? {...t, ...patch} : t)));
    }, []);

    const setTaskSolution = useCallback((id: string, solution: string) => {
        updateTask(id, {solution});
        if (id === selectedId && showSolution) {
            setEditorSolution(solution);
        }
    }, [updateTask, selectedId, showSolution]);

    const clearSelectedFields = () => {
        setHeaderInput('');
        // optional: deselect so UI shows default task
        setSelectedId(null);
        setShowSolution(false);
        setRunTest(false);
        setEditorSolution('No solution available.');
    };

    // при смене задачи очистим ввод пользователя
    useEffect(() => {
        setEditorUserCode('');
    }, [selectedId]);

    // sync provider tasks with source
    useEffect(() => {
        setTasks(sourceTasks);
    }, [sourceTasks]);

    // keep selectedId valid and initialized
    useEffect(() => {
        if (!selectedId) return;
        if (!tasks.some(t => t.id === selectedId)) setSelectedId(null);
    }, [tasks, selectedId]);

    useEffect(() => {
        setShowSolution(false);
        setRunTest(false);
        setValidSolution(false);
    }, [selectedId]);


    useEffect(() => {
        if (!selectedId || !showSolution) {
            setEditorSolution('No solution available.');
        } else {
            setEditorSolution(selectedTask?.solution ?? 'No solution available.');
        }
    }, [selectedId, showSolution, selectedTask?.solution]);

    // Debug: log headerInput changes to verify context updates
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.debug('[TaskProvider] headerInput changed ->', JSON.stringify(headerInput));
    }, [headerInput]);

    const value = useMemo<TaskContextValue>(() => ({
        tasks,
        selectedId,
        selectedTask,
        setSelectedId,
        headerInput,
        setHeaderInput,
        updateTask,
        setTaskSolution,
        clearSelectedFields,
        showSolution,
        setShowSolution,
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
    }), [
        tasks,
        selectedId,
        selectedTask,
        headerInput,
        showSolution,
        runTest,
        validSolution,
        selectPreviousTask,
        selectNextTask,
        editorSolution,
        editorUserCode,
    ]);
    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext() {
    const ctx = useContext(TaskContext);
    if (!ctx) throw new Error('useTaskContext must be used inside TaskProvider');
    return ctx;
}
