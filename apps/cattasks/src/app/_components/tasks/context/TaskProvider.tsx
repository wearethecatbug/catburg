'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {CatalogTask} from '../catalog/taskCatalog';
import {useTasksArr} from '../hooks/UseTasks';
import {
    beginTaskRun,
    clearTaskSelection,
    completeTaskRun,
    createTaskWorkspaceState,
    type ContentTab,
    type TaskRunRecord,
    type TaskRunToken,
    type TaskWorkspace,
    type TaskWorkspaceState,
    selectTask as selectTaskState,
    setTaskDraft as setTaskDraftState,
} from './taskWorkspaceState';
import type {IsolatedTaskResult} from '../lib/IsolatedTaskRunner';

type TaskContextValue = {
    tasks: readonly CatalogTask[];
    catalogError: Error | null;
    retryCatalog: () => void;
    selectedId: string | null;
    selectedTask: CatalogTask | null;
    selectedWorkspace: TaskWorkspace | null;
    headerInput: string;
    setTaskFilter: (value: string) => void;
    selectTask: (id: string) => void;
    clearSelection: () => void;
    selectPreviousTask: () => void;
    selectNextTask: () => void;
    activeContentTab: ContentTab;
    selectContentTab: (tab: ContentTab) => void;
    setSelectedDraft: (draft: string) => void;
    beginSelectedRun: (mode: TaskRunRecord['mode']) => TaskRunToken | null;
    completeRun: (token: TaskRunToken, result: IsolatedTaskResult) => void;
};

const TaskContext = createContext<TaskContextValue | undefined>(undefined);
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

export function TaskProvider({children}: { children: React.ReactNode }) {
    const {tasks, error: catalogError, retry: retryCatalog} = useTasksArr();
    const [workspaceState, setWorkspaceState] = useState<TaskWorkspaceState>(createTaskWorkspaceState);
    const workspaceStateRef = useRef(workspaceState);
    workspaceStateRef.current = workspaceState;
    const [headerInput, setHeaderInput] = useState('');
    const didInitializeSelection = useRef(false);

    const selectedTask = useMemo(() => {
        if (!workspaceState.selectedId) return null;
        return tasks.find(task => task.id === workspaceState.selectedId) ?? null;
    }, [tasks, workspaceState.selectedId]);
    const selectedWorkspace = selectedTask
        ? workspaceState.workspaces.get(selectedTask.id) ?? {draft: selectedTask.starterCode, draftGeneration: 0, runGeneration: 0}
        : null;

    const commitState = useCallback((nextState: TaskWorkspaceState) => {
        workspaceStateRef.current = nextState;
        setWorkspaceState(nextState);
    }, []);

    const selectTask = useCallback((id: string) => {
        const task = tasks.find(candidate => candidate.id === id);
        if (!task) return;
        commitState(selectTaskState(workspaceStateRef.current, task.id, task.starterCode));
        setHeaderInput(`${task.ordinal}. ${task.title}`);
    }, [commitState, tasks]);

    const clearSelection = useCallback(() => {
        didInitializeSelection.current = true;
        commitState(clearTaskSelection(workspaceStateRef.current));
        setHeaderInput('');
    }, [commitState]);

    useEffect(() => {
        if (didInitializeSelection.current || tasks.length === 0) return;
        didInitializeSelection.current = true;
        selectTask(tasks[0].id);
    }, [selectTask, tasks]);

    const selectPreviousTask = useCallback(() => {
        if (tasks.length === 0) return;
        const selectedId = workspaceStateRef.current.selectedId;
        const currentIndex = selectedId ? tasks.findIndex(task => task.id === selectedId) : -1;
        selectTask(tasks[modulo(currentIndex === -1 ? tasks.length - 1 : currentIndex - 1, tasks.length)].id);
    }, [selectTask, tasks]);

    const selectNextTask = useCallback(() => {
        if (tasks.length === 0) return;
        const selectedId = workspaceStateRef.current.selectedId;
        const currentIndex = selectedId ? tasks.findIndex(task => task.id === selectedId) : -1;
        selectTask(tasks[modulo(currentIndex + 1, tasks.length)].id);
    }, [selectTask, tasks]);

    const selectContentTab = useCallback((activeContentTab: ContentTab) => {
        const current = workspaceStateRef.current;
        if (current.activeContentTab === activeContentTab) return;
        commitState({...current, activeContentTab});
    }, [commitState]);

    const setSelectedDraft = useCallback((draft: string) => {
        const task = tasks.find(candidate => candidate.id === workspaceStateRef.current.selectedId);
        if (!task) return;
        commitState(setTaskDraftState(workspaceStateRef.current, task.id, draft, task.starterCode));
    }, [commitState, tasks]);

    const beginSelectedRun = useCallback((mode: TaskRunRecord['mode']) => {
        const task = tasks.find(candidate => candidate.id === workspaceStateRef.current.selectedId);
        if (!task) return null;
        const started = beginTaskRun(workspaceStateRef.current, task.id, task.starterCode, mode);
        if (!started) return null;
        commitState(started.state);
        return started.token;
    }, [commitState, tasks]);

    const completeRun = useCallback((token: TaskRunToken, result: IsolatedTaskResult) => {
        commitState(completeTaskRun(workspaceStateRef.current, token, result));
    }, [commitState]);

    const value: TaskContextValue = {
        tasks,
        catalogError,
        retryCatalog,
        selectedId: workspaceState.selectedId,
        selectedTask,
        selectedWorkspace,
        headerInput,
        setTaskFilter: setHeaderInput,
        selectTask,
        clearSelection,
        selectPreviousTask,
        selectNextTask,
        activeContentTab: workspaceState.activeContentTab,
        selectContentTab,
        setSelectedDraft,
        beginSelectedRun,
        completeRun,
    };

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext() {
    const context = useContext(TaskContext);
    if (!context) throw new Error('useTaskContext must be used inside TaskProvider');
    return context;
}
