'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {CatalogTask} from '../catalog/taskCatalog';
import {getTaskCatalogueRows, type TaskCatalogueRow} from '../catalog/taskCatalogueRows';
import {appendCustomTasks, getCustomTaskExport, loadCustomTasks} from '../customTasks/customTaskStorage';
import {exportCustomTasks as serializeCustomTasks, preflightCustomTaskImport} from '../customTasks/customTaskTransfer';
import type {CustomTaskRecord, CustomTaskResult} from '../customTasks/customTaskTypes';
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
    customStorageReady: boolean;
    addCustomTasks: (incoming: readonly CustomTaskRecord[], signal?: AbortSignal) => Promise<boolean>;
    prepareCustomTaskImport: (text: string) => CustomTaskResult;
    exportCustomTasks: () => Promise<string | null>;
    retryCustomStorage: () => void;
    recoveryCustomTaskExport: string | null;
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
    const [customStorageReady, setCustomStorageReady] = useState(false);
    const [recoveryCustomTaskExport, setRecoveryCustomTaskExport] = useState<string | null>(null);
    const tasksRef = useRef(tasks);
    const customTasksRef = useRef(customTasks);
    const catalogErrorRef = useRef(catalogError);
    const customStorageReadyRef = useRef(customStorageReady);
    const storageOperationTail = useRef<Promise<void>>(Promise.resolve());
    tasksRef.current = tasks;
    customTasksRef.current = customTasks;
    catalogErrorRef.current = catalogError;
    customStorageReadyRef.current = customStorageReady;
    const didInitializeSelection = useRef(false);

    const allTasks = useMemo<readonly CatalogTask[]>(() => [
        ...tasks,
        ...customTasks.filter(task => !tasks.some(builtIn => builtIn.id === task.id)).map((task, index) => ({...task, ordinal: tasks.length + index + 1})),
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

    const enqueueStorageOperation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
        const queued = storageOperationTail.current.then(operation, operation);
        storageOperationTail.current = queued.then(() => undefined, () => undefined);
        return queued;
    }, []);

    const commitState = useCallback((nextState: TaskWorkspaceState) => {
        workspaceStateRef.current = nextState;
        setWorkspaceState(nextState);
    }, []);

    // Failed storage reads invalidate the projection, but workspace history stays inert until the normal session reset.
    const quarantineCustomTasks = useCallback((message: string, recoveryRaw: string | null) => {
        const removedCustomIds = new Set(customTasksRef.current.map(task => task.id));
        const selectedId = workspaceStateRef.current.selectedId;
        customTasksRef.current = [];
        customStorageReadyRef.current = false;
        setCustomTasks([]);
        setCustomStorageReady(false);
        // Only validated collision reads provide raw recovery bytes; other failures remain non-exportable.
        setRecoveryCustomTaskExport(recoveryRaw);
        if (selectedId && removedCustomIds.has(selectedId)) {
            commitState(clearTaskSelection(workspaceStateRef.current));
            setHeaderInput('');
        }
        setCustomStorageError(message);
    }, [commitState]);

    const readCustomStorage = useCallback(() => {
        if (tasks.length === 0 || catalogError) return;
        customStorageReadyRef.current = false;
        // A pending reread blocks writes without discarding the last validated projection.
        setCustomStorageReady(false);
        void enqueueStorageOperation(() => loadCustomTasks(() => window.localStorage, builtInIds))
            .then(saved => {
            if (saved.ok) {
                customTasksRef.current = saved.tasks;
                customStorageReadyRef.current = true;
                setCustomTasks(saved.tasks);
                setCustomStorageReady(true);
                setCustomStorageError(null);
                setRecoveryCustomTaskExport(null);
            } else {
                quarantineCustomTasks(saved.message, saved.recoveryRaw ?? null);
            }
        })
            .catch(error => {
                quarantineCustomTasks(error instanceof Error ? error.message : 'Custom task storage is unavailable', null);
            });
    }, [builtInIds, catalogError, enqueueStorageOperation, quarantineCustomTasks, tasks.length]);

    useEffect(() => {
        readCustomStorage();
    }, [readCustomStorage]);

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

    const addCustomTasks = useCallback(async (incoming: readonly CustomTaskRecord[], signal?: AbortSignal) => {
        if (signal?.aborted) return false;
        if (tasksRef.current.length === 0 || catalogErrorRef.current || !customStorageReadyRef.current) {
            setCustomStorageError('Tasks must finish loading before custom tasks can be saved.');
            return false;
        }
        return enqueueStorageOperation(async () => {
            if (signal?.aborted) return false;
            if (tasksRef.current.length === 0 || catalogErrorRef.current || !customStorageReadyRef.current) {
                setCustomStorageError('Tasks must finish loading before custom tasks can be saved.');
                return false;
            }
            const saved = await appendCustomTasks(
                incoming,
                new Set(tasksRef.current.map(task => task.id)),
                signal,
            );
            if (!saved.ok) {
                if (!signal?.aborted) setCustomStorageError(saved.message);
                return false;
            }
            customTasksRef.current = saved.tasks;
            setCustomTasks(saved.tasks);
            setCustomStorageError(null);
            return !signal?.aborted;
        }).catch(error => {
            if (signal?.aborted) return false;
            setCustomStorageError(error instanceof Error ? error.message : 'Custom task storage is unavailable');
            return false;
        });
    }, [enqueueStorageOperation]);

    const prepareCustomTaskImport = useCallback((text: string): CustomTaskResult => {
        if (tasksRef.current.length === 0 || catalogErrorRef.current || !customStorageReadyRef.current) {
            return {ok: false, message: 'Tasks must finish loading before custom tasks can be imported.'};
        }
        return preflightCustomTaskImport(
            text,
            new Set(tasksRef.current.map(task => task.id)),
            new Set(customTasksRef.current.map(task => task.id)),
        );
    }, []);

    const exportCustomTasks = useCallback(() => {
        return enqueueStorageOperation(async () => {
            const saved = await getCustomTaskExport(new Set(tasksRef.current.map(task => task.id)));
            if (!saved.ok) {
                quarantineCustomTasks(saved.message, saved.recoveryRaw ?? null);
                return null;
            }
            return serializeCustomTasks(saved.tasks);
        }).catch(error => {
            quarantineCustomTasks(error instanceof Error ? error.message : 'Custom task storage is unavailable', null);
            return null;
        });
    }, [enqueueStorageOperation, quarantineCustomTasks]);

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
        customStorageReady,
        addCustomTasks,
        prepareCustomTaskImport,
        exportCustomTasks,
        retryCustomStorage: readCustomStorage,
        recoveryCustomTaskExport,
    };

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext() {
    const context = useContext(TaskContext);
    if (!context) throw new Error('useTaskContext must be used inside TaskProvider');
    return context;
}
