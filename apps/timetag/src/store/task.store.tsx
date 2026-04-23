'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  AssignableWorkspaceType,
  Task,
  TaskStatus,
  WorkspaceType,
  CreateTaskInput,
  FilterState,
  SortState,
  TimerStatus,
} from '@/domain/task.types';
import { applyPipeline, createPipelineQuery } from '@/domain/task.pipeline';
import { createDefaultTaskFilter } from '@/domain/task.filter';
import {
  createTask as createTaskFromInput,
  mergeTaskUpdates,
  normalizeHydratedTasks,
  pauseOtherRunningTasks,
} from '@/domain/task.operations';
import { supportsTimer } from '@/domain/task.mode';
import { transitionStatus, toggleDoneStatus } from '@/domain/task.status';
import { toggleTimerState, resetTimerState, tickTimer } from '@/domain/timer.logic';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';
import { useSettings } from './settings.store';

// ============================================================================
// State
// ============================================================================

interface TaskState {
  tasks: Task[];
  workspace: WorkspaceType;
  lastConcreteWorkspace?: AssignableWorkspaceType;
  filter: FilterState;
  sort: SortState;
  searchQuery: string;
  selectedIds: Set<string>;
  undoStack: Task[] | null;
}

// ============================================================================
// Actions
// ============================================================================

type TaskAction =
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: { input: CreateTaskInput; nowIso: string; pauseOthers: boolean } }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task>; nowIso: string } }
  | { type: 'TOGGLE_STATUS'; payload: { id: string; nowIso: string } }
  | { type: 'SET_STATUS'; payload: { id: string; status: TaskStatus; nowIso: string } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'DELETE_SELECTED' }
  | { type: 'TOGGLE_TIMER'; payload: { id: string; nowIso: string; pauseOthers: boolean } }
  | { type: 'RESET_TIMER'; payload: { id: string; nowIso: string } }
  | { type: 'TICK_TIMERS' }
  | { type: 'SET_WORKSPACE'; payload: WorkspaceType }
  | { type: 'SET_FILTER'; payload: Partial<FilterState> }
  | { type: 'SET_SORT'; payload: SortState }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'TOGGLE_SELECT'; payload: string }
  | { type: 'SELECT_ALL'; payload: { showCompletedTasks: boolean } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'PAUSE_SELECTED' }
  | { type: 'PLAY_SELECTED' }
  | { type: 'RESET_SELECTED' }
  | { type: 'MARK_DONE_SELECTED'; payload: { nowIso: string } }
  | { type: 'ARCHIVE_SELECTED'; payload: { nowIso: string } }
  | { type: 'UNDO_DELETE' };

// ============================================================================
// Defaults
// ============================================================================

const initialFilter: FilterState = createDefaultTaskFilter();

const initialSort: SortState = { field: 'createdAt', direction: 'desc' };

const initialState: TaskState = {
  tasks: [],
  workspace: 'all',
  lastConcreteWorkspace: undefined,
  filter: initialFilter,
  sort: initialSort,
  searchQuery: '',
  selectedIds: new Set(),
  undoStack: null,
};

// ============================================================================
// Reducer (delegates to domain functions)
// ============================================================================

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'ADD_TASK': {
      const nextTask = createTaskFromInput(action.payload.input, action.payload.nowIso);
      const nextTasks =
        supportsTimer(nextTask.timerMode) && nextTask.timerStatus === 'running' && action.payload.pauseOthers
          ? pauseOtherRunningTasks(state.tasks, nextTask.id, action.payload.nowIso)
          : state.tasks;

      return { ...state, tasks: [nextTask, ...nextTasks] };
    }

    case 'UPDATE_TASK': {
      const { id, updates, nowIso } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? mergeTaskUpdates(t, updates, nowIso) : t)),
      };
    }

    case 'TOGGLE_STATUS': {
      const targetTask = state.tasks.find((task) => task.id === action.payload.id);
      if (!targetTask) return state;

      const patch = toggleDoneStatus(targetTask, action.payload.nowIso);
      if (!patch) return state;

      return {
        ...state,
        tasks: state.tasks.map((task) => (
          task.id === action.payload.id ? { ...task, ...patch } : task
        )),
      };
    }

    case 'SET_STATUS': {
      const targetTask = state.tasks.find((task) => task.id === action.payload.id);
      if (!targetTask) return state;

      const patch = transitionStatus(targetTask, action.payload.status, action.payload.nowIso);
      if (!patch) return state;

      return {
        ...state,
        tasks: state.tasks.map((task) => (
          task.id === action.payload.id ? { ...task, ...patch } : task
        )),
      };
    }

    case 'DELETE_TASK': {
      const toDelete = state.tasks.find((t) => t.id === action.payload);
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
        undoStack: toDelete ? [toDelete] : null,
        selectedIds: new Set([...state.selectedIds].filter((id) => id !== action.payload)),
      };
    }

    case 'DELETE_SELECTED': {
      const selected = state.tasks.filter((t) => state.selectedIds.has(t.id));
      return {
        ...state,
        tasks: state.tasks.filter((t) => !state.selectedIds.has(t.id)),
        undoStack: selected.length > 0 ? selected : null,
        selectedIds: new Set(),
      };
    }

    // Timer actions — delegated to domain/timer.logic
    case 'TOGGLE_TIMER': {
      const targetTask = state.tasks.find((task) => task.id === action.payload.id);
      if (!targetTask || !supportsTimer(targetTask.timerMode)) return state;

      const patch = toggleTimerState(targetTask, action.payload.nowIso);
      const nextTimerStatus = (patch.timerStatus ?? targetTask.timerStatus) as TimerStatus;

      let nextTasks = state.tasks.map((task) => (
        task.id === action.payload.id ? { ...task, ...patch } : task
      ));

      if (action.payload.pauseOthers && nextTimerStatus === 'running') {
        nextTasks = pauseOtherRunningTasks(nextTasks, action.payload.id, action.payload.nowIso);
      }

      return {
        ...state,
        tasks: nextTasks,
      };
    }

    case 'RESET_TIMER':
      if (!state.tasks.some((task) => task.id === action.payload.id && supportsTimer(task.timerMode))) {
        return state;
      }

      return {
        ...state,
        tasks: state.tasks.map((t) =>
            t.id === action.payload.id ? { ...t, ...resetTimerState(t, action.payload.nowIso) } : t,
        ),
      };

    case 'TICK_TIMERS':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          const patch = tickTimer(t);
          return patch ? { ...t, ...patch } : t;
        }),
      };

    // Query actions
    case 'SET_WORKSPACE':
      return {
        ...state,
        workspace: action.payload,
        lastConcreteWorkspace: action.payload !== 'all' ? action.payload : state.lastConcreteWorkspace,
        selectedIds: new Set(),
      };

    case 'SET_FILTER':
      return { ...state, filter: { ...state.filter, ...action.payload } };

    case 'SET_SORT':
      return { ...state, sort: action.payload };

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };

    // Selection
    case 'TOGGLE_SELECT': {
      const next = new Set(state.selectedIds);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, selectedIds: next };
    }

    case 'SELECT_ALL': {
      const query = createPipelineQuery({
        workspace: state.workspace,
        filter: state.filter,
        sort: state.sort,
        searchQuery: state.searchQuery,
      }, action.payload.showCompletedTasks);
      const visible = applyPipeline(state.tasks, query);
      return { ...state, selectedIds: new Set(visible.map((t) => t.id)) };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set() };

    // Bulk actions
    case 'PAUSE_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id) && supportsTimer(t.timerMode) && t.timerStatus === 'running'
            ? { ...t, timerStatus: 'paused' as TimerStatus }
            : t,
        ),
      };

    case 'PLAY_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id) &&
          supportsTimer(t.timerMode) &&
          (t.timerStatus === 'paused' || t.timerStatus === 'idle')
            ? { ...t, timerStatus: 'running' as TimerStatus }
            : t,
        ),
      };

    case 'RESET_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id) && supportsTimer(t.timerMode)
            ? { ...t, remainingSec: t.originalDurationSec, timerStatus: 'idle' as TimerStatus }
            : t,
        ),
      };

    case 'MARK_DONE_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? { ...t, ...(transitionStatus(t, 'done', action.payload.nowIso) ?? {}) }
            : t,
        ),
        selectedIds: new Set(),
      };

    case 'ARCHIVE_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? { ...t, ...(transitionStatus(t, 'archived', action.payload.nowIso) ?? {}) }
            : t,
        ),
        selectedIds: new Set(),
      };

    case 'UNDO_DELETE':
      if (!state.undoStack) return state;
      return { ...state, tasks: [...state.undoStack, ...state.tasks], undoStack: null };

    default:
      return state;
  }
}

// ============================================================================
// Context Value
// ============================================================================

interface TaskContextValue {
  state: TaskState;
  visibleTasks: Task[];
  dispatch: React.Dispatch<TaskAction>;
  addTask: (input: CreateTaskInput) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  toggleTimer: (id: string) => void;
  resetTimer: (id: string) => void;
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  setWorkspace: (workspace: WorkspaceType) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  setSort: (sort: SortState) => void;
  setSearch: (query: string) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  pauseSelected: () => void;
  playSelected: () => void;
  resetSelected: () => void;
  markDoneSelected: () => void;
  archiveSelected: () => void;
  undoDelete: () => void;
  hasSelection: boolean;
  canUndo: boolean;
}

const TaskContext = createContext<TaskContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [savedTasks, setSavedTasks, isSavedTasksHydrated] =
    useLocalStorage<Task[]>('timetag-tasks', []);

  // Always initialize with empty tasks to avoid hydration mismatch
  const [state, dispatch] = useReducer(taskReducer, initialState);

  // Track if we've loaded from localStorage
  const hasLoadedRef = useRef(false);

  // Persist to localStorage after initial storage hydration + task hydration complete.
  useEffect(() => {
    if (!isSavedTasksHydrated || !hasLoadedRef.current) return;
    setSavedTasks(state.tasks);
  }, [state.tasks, setSavedTasks, isSavedTasksHydrated]);

  // Hydrate from localStorage when storage read is complete.
  useEffect(() => {
    if (!isSavedTasksHydrated || hasLoadedRef.current) return;

    if (savedTasks.length > 0) {
      dispatch({ type: 'SET_TASKS', payload: normalizeHydratedTasks(savedTasks) });
    }

    // Mark hydration complete even when storage is empty.
    hasLoadedRef.current = true;
  }, [savedTasks, isSavedTasksHydrated]);

  // Timer tick engine
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRunning = state.tasks.some((t) => t.timerStatus === 'running');

  useEffect(() => {
    if (hasRunning) {
      timerRef.current = setInterval(() => dispatch({ type: 'TICK_TIMERS' }), 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hasRunning]);

  // Pipeline via domain
  const visibleTasks = useMemo(
    () => applyPipeline(
      state.tasks,
      createPipelineQuery({
        workspace: state.workspace,
        filter: state.filter,
        sort: state.sort,
        searchQuery: state.searchQuery,
      }, settings.general.showCompletedTasks),
    ),
    [settings.general.showCompletedTasks, state],
  );

  const shouldPauseOtherTimers = settings.general.autoPauseOtherTimers || !settings.timer.allowMultipleTimers;

  useEffect(() => {
    if (settings.general.showCompletedTasks) {
      return;
    }

    if (state.filter.status === 'done' || state.filter.status === 'archived') {
      dispatch({ type: 'SET_FILTER', payload: { status: 'active' } });
    }
  }, [settings.general.showCompletedTasks, state.filter.status]);

  // Convenience dispatchers
  const addTask = useCallback(
    (input: CreateTaskInput) => dispatch({
      type: 'ADD_TASK',
      payload: { input, nowIso: new Date().toISOString(), pauseOthers: shouldPauseOtherTimers },
    }),
    [shouldPauseOtherTimers],
  );
  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => dispatch({
      type: 'UPDATE_TASK',
      payload: { id, updates, nowIso: new Date().toISOString() },
    }),
    [],
  );
  const deleteTask = useCallback((id: string) => dispatch({ type: 'DELETE_TASK', payload: id }), []);
  const toggleTaskStatus = useCallback(
    (id: string) => dispatch({ type: 'TOGGLE_STATUS', payload: { id, nowIso: new Date().toISOString() } }),
    [],
  );
  const toggleTimer = useCallback(
    (id: string) => dispatch({
      type: 'TOGGLE_TIMER',
      payload: { id, nowIso: new Date().toISOString(), pauseOthers: shouldPauseOtherTimers },
    }),
    [shouldPauseOtherTimers],
  );
  const resetTimer = useCallback((id: string) => dispatch({ type: 'RESET_TIMER', payload: { id, nowIso: new Date().toISOString() } }), [],);
  const archiveTask = useCallback(
    (id: string) => dispatch({ type: 'SET_STATUS', payload: { id, status: 'archived', nowIso: new Date().toISOString() } }),
    [],
  );
  const restoreTask = useCallback(
    (id: string) => dispatch({ type: 'SET_STATUS', payload: { id, status: 'active', nowIso: new Date().toISOString() } }),
    [],
  );
  const setWorkspace = useCallback((ws: WorkspaceType) => dispatch({ type: 'SET_WORKSPACE', payload: ws }), []);
  const setFilter = useCallback((f: Partial<FilterState>) => dispatch({ type: 'SET_FILTER', payload: f }), []);
  const setSort = useCallback((s: SortState) => dispatch({ type: 'SET_SORT', payload: s }), []);
  const setSearch = useCallback((q: string) => dispatch({ type: 'SET_SEARCH', payload: q }), []);
  const toggleSelect = useCallback((id: string) => dispatch({ type: 'TOGGLE_SELECT', payload: id }), []);
  const selectAll = useCallback(
    () => dispatch({ type: 'SELECT_ALL', payload: { showCompletedTasks: settings.general.showCompletedTasks } }),
    [settings.general.showCompletedTasks],
  );
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []);
  const deleteSelected = useCallback(() => dispatch({ type: 'DELETE_SELECTED' }), []);
  const pauseSelected = useCallback(() => dispatch({ type: 'PAUSE_SELECTED' }), []);
  const playSelected = useCallback(() => dispatch({ type: 'PLAY_SELECTED' }), []);
  const resetSelected = useCallback(() => dispatch({ type: 'RESET_SELECTED' }), []);
  const markDoneSelected = useCallback(
    () => dispatch({ type: 'MARK_DONE_SELECTED', payload: { nowIso: new Date().toISOString() } }),
    [],
  );
  const archiveSelected = useCallback(
    () => dispatch({ type: 'ARCHIVE_SELECTED', payload: { nowIso: new Date().toISOString() } }),
    [],
  );
  const undoDelete = useCallback(() => dispatch({ type: 'UNDO_DELETE' }), []);

  const value: TaskContextValue = {
    state,
    visibleTasks,
    dispatch,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleTimer,
    resetTimer,
    archiveTask,
    restoreTask,
    setWorkspace,
    setFilter,
    setSort,
    setSearch,
    toggleSelect,
    selectAll,
    clearSelection,
    deleteSelected,
    pauseSelected,
    playSelected,
    resetSelected,
    markDoneSelected,
    archiveSelected,
    undoDelete,
    hasSelection: state.selectedIds.size > 0,
    canUndo: state.undoStack !== null,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within a TaskProvider');
  return ctx;
}

