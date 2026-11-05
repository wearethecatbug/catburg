'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {CatalogTask} from '../catalog/taskCatalog';
import {getTaskCatalogueRows, type TaskCatalogueRow} from '../catalog/taskCatalogueRows';
import {appendCustomTasks, loadCustomTasks} from '../customTasks/customTaskStorage';
import type {CustomTaskRecord} from '../customTasks/customTaskTypes';
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
    catalogueRows: readonly TaskCatalogueRow[];
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
    customTasks: readonly CustomTaskRecord[];
    customStorageError: string | null;
    addCustomTasks: (incoming: readonly CustomTaskRecord[]) => boolean;
    retryCustomStorage: () => void;
};

const TaskContext = createContext<TaskContextValue | undefined>(undefined);
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

export function TaskProvider({children}: { children: React.ReactNode }) {
    const {tasks, error: catalogError, retry: retryCatalog} = useTasksArr();
    const [workspaceState, setWorkspaceState] = useState<TaskWorkspaceState>(createTaskWorkspaceState);
    const workspaceStateRef = useRef(workspaceState);
    workspaceStateRef.current = workspaceState;
    const [headerInput, setHeaderInput] = useState('');
    const [customTasks, setCustomTasks] = useState<readonly CustomTaskRecord[]>([]);
    const [customStorageError, setCustomStorageError] = useState<string | null>(null);
    const didInitializeSelection = useRef(false);

    const allTasks = useMemo<readonly CatalogTask[]>(() => [
        ...tasks,
        ...customTasks.map((task, index) => ({...task, ordinal: tasks.length + index + 1})),
    ], [customTasks, tasks]);
    const builtInIds = useMemo(() => new Set(tasks.map(task => task.id)), [tasks]);
    const customTopics = useMemo(
        () => new Map(customTasks.map(task => [task.id, task.topic] as const)),
        [customTasks],
    );
    const selectedTask = useMemo(() => {
        if (!workspaceState.selectedId) return null;
        return allTasks.find(task => task.id === workspaceState.selectedId) ?? null;
    }, [allTasks, workspaceState.selectedId]);
    const selectedWorkspace = selectedTask
        ? workspaceState.workspaces.get(selectedTask.id) ?? {draft: selectedTask.starterCode, draftGeneration: 0, runGeneration: 0}
        : null;
    const catalogueRows = useMemo(
        () => getTaskCatalogueRows(allTasks, workspaceState, customTopics),
        [allTasks, customTopics, workspaceState],
    );

    const readCustomStorage = useCallback(() => {
        if (tasks.length === 0 || catalogError) return;
        try {
            const saved = loadCustomTasks(window.localStorage, builtInIds);
            if (saved.ok) {
                setCustomTasks(saved.tasks);
                setCustomStorageError(null);
            } else {
                setCustomStorageError(saved.message);
            }
        } catch (error) {
            setCustomStorageError(error instanceof Error ? error.message : 'Custom task storage is unavailable');
        }
    }, [builtInIds, catalogError, tasks.length]);

    useEffect(() => {
        readCustomStorage();
    }, [readCustomStorage]);

    const commitState = useCallback((nextState: TaskWorkspaceState) => {
        workspaceStateRef.current = nextState;
        setWorkspaceState(nextState);
    }, []);

    const selectTask = useCallback((id: string) => {
        const task = allTasks.find(candidate => candidate.id === id);
        if (!task) return;
        commitState(selectTaskState(workspaceStateRef.current, task.id, task.starterCode));
        setHeaderInput(`${task.ordinal}. ${task.title}`);
    }, [allTasks, commitState]);

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
        if (allTasks.length === 0) return;
        const selectedId = workspaceStateRef.current.selectedId;
        const currentIndex = selectedId ? allTasks.findIndex(task => task.id === selectedId) : -1;
        selectTask(allTasks[modulo(currentIndex === -1 ? allTasks.length - 1 : currentIndex - 1, allTasks.length)].id);
    }, [allTasks, selectTask]);

    const selectNextTask = useCallback(() => {
        if (allTasks.length === 0) return;
        const selectedId = workspaceStateRef.current.selectedId;
        const currentIndex = selectedId ? allTasks.findIndex(task => task.id === selectedId) : -1;
        selectTask(allTasks[modulo(currentIndex + 1, allTasks.length)].id);
    }, [allTasks, selectTask]);

    const selectContentTab = useCallback((activeContentTab: ContentTab) => {
        const current = workspaceStateRef.current;
        if (current.activeContentTab === activeContentTab) return;
        commitState({...current, activeContentTab});
    }, [commitState]);

    const setSelectedDraft = useCallback((draft: string) => {
        const task = allTasks.find(candidate => candidate.id === workspaceStateRef.current.selectedId);
        if (!task) return;
        commitState(setTaskDraftState(workspaceStateRef.current, task.id, draft, task.starterCode));
    }, [allTasks, commitState]);

    const beginSelectedRun = useCallback((mode: TaskRunRecord['mode']) => {
        const task = allTasks.find(candidate => candidate.id === workspaceStateRef.current.selectedId);
        if (!task) return null;
        const started = beginTaskRun(workspaceStateRef.current, task.id, task.starterCode, mode);
        if (!started) return null;
        commitState(started.state);
        return started.token;
    }, [allTasks, commitState]);

    const addCustomTasks = useCallback((incoming: readonly CustomTaskRecord[]) => {
        if (tasks.length === 0 || catalogError) {
            setCustomStorageError('Tasks must finish loading before custom tasks can be saved.');
            return false;
        }
        try {
            const saved = appendCustomTasks(window.localStorage, incoming, builtInIds);
            if (!saved.ok) {
                setCustomStorageError(saved.message);
                return false;
            }
            setCustomTasks(saved.tasks);
            setCustomStorageError(null);
            return true;
        } catch (error) {
            setCustomStorageError(error instanceof Error ? error.message : 'Custom task storage is unavailable');
            return false;
        }
    }, [builtInIds, catalogError, tasks.length]);

    const completeRun = useCallback((token: TaskRunToken, result: IsolatedTaskResult) => {
        commitState(completeTaskRun(workspaceStateRef.current, token, result));
    }, [commitState]);

    const value: TaskContextValue = {
        tasks: allTasks,
        catalogueRows,
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
        customTasks,
        customStorageError,
        addCustomTasks,
        retryCustomStorage: readCustomStorage,
    };

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext() {
    const context = useContext(TaskContext);
    if (!context) throw new Error('useTaskContext must be used inside TaskProvider');
    return context;
}
