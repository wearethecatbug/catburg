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
  Task,
  TaskStatus,
  WorkspaceType,
  CreateTaskInput,
  FilterState,
  SortState,
  TimerStatus,
} from '@/domain/task.types';
import { applyPipeline } from '@/domain/task.pipeline';
import { toggleTimerState, resetTimerState, tickTimer } from '@/domain/timer.logic';
import { generateId } from '@/domain/helpers';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';

// ============================================================================
// State
// ============================================================================

interface TaskState {
  tasks: Task[];
  workspace: WorkspaceType;
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
  | { type: 'ADD_TASK'; payload: CreateTaskInput }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task> } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'DELETE_SELECTED' }
  | { type: 'TOGGLE_TIMER'; payload: { id: string; nowIso: string } }
  | { type: 'RESET_TIMER'; payload: { id: string; nowIso: string } }
  | { type: 'TICK_TIMERS' }
  | { type: 'SET_WORKSPACE'; payload: WorkspaceType }
  | { type: 'SET_FILTER'; payload: Partial<FilterState> }
  | { type: 'SET_SORT'; payload: SortState }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'TOGGLE_SELECT'; payload: string }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'PAUSE_SELECTED' }
  | { type: 'PLAY_SELECTED' }
  | { type: 'RESET_SELECTED' }
  | { type: 'MARK_DONE_SELECTED' }
  | { type: 'ARCHIVE_SELECTED' }
  | { type: 'UNDO_DELETE' };

// ============================================================================
// Defaults
// ============================================================================

const initialFilter: FilterState = {
  status: 'active',
  urgency: { normal: true, warn: true, danger: true, overdue: true },
  approachingRed: { enabled: false, windowMinutes: 10 },
  mode: { duration: true, pomodoro: true, deadline: true },
  hasReminders: 'any',
};

const initialSort: SortState = { field: 'createdAt', direction: 'desc' };

const initialState: TaskState = {
  tasks: [],
  workspace: 'all',
  filter: initialFilter,
  sort: initialSort,
  searchQuery: '',
  selectedIds: new Set(),
  undoStack: null,
};

// ============================================================================
// Task Factory
// ============================================================================

function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();

  // For deadline mode: calculate remainingSec from targetAt
  // For other modes: use durationSec with default fallback
  const isDeadlineMode = input.timerMode === 'deadline';

  let durationSec: number;
  if (isDeadlineMode) {
    // Calculate remaining seconds from targetAt to now
    if (input.targetAt) {
      const targetTime = new Date(input.targetAt).getTime();
      const nowTime = new Date(now).getTime();
      durationSec = Math.max(0, Math.floor((targetTime - nowTime) / 1000));
    } else {
      durationSec = 0;
    }
  } else {
    durationSec = input.durationSec ?? 25 * 60;
  }

  return {
    id: generateId(),
    title: input.title,
    workspace: input.workspace ?? 'work',
    status: 'active',
    timerMode: input.timerMode ?? 'duration',
    targetAt: input.targetAt,
    remainingSec: durationSec,
    originalDurationSec: durationSec,
    timerStatus: input.timerControls?.autoStart ? 'running' : 'idle',
    timerControls: input.timerControls ?? {
      autoStart: false,
      autoPlay: false,
      autoReset: false,
      allowOverdue: false,
    },
    pomodoro: input.pomodoro,
    reminders: input.reminders ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Reducer (delegates to domain functions)
// ============================================================================

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'ADD_TASK':
      return { ...state, tasks: [createTask(action.payload), ...state.tasks] };

    case 'UPDATE_TASK': {
      const { id, updates } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
        ),
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
    case 'TOGGLE_TIMER':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
            t.id === action.payload.id ? { ...t, ...toggleTimerState(t, action.payload.nowIso) } : t,
        ),
      };

    case 'RESET_TIMER':
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
      return { ...state, workspace: action.payload, selectedIds: new Set() };

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
      const query = {
        workspace: state.workspace,
        filter: state.filter,
        sort: state.sort,
        searchQuery: state.searchQuery,
      };
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
          state.selectedIds.has(t.id) && t.timerStatus === 'running'
            ? { ...t, timerStatus: 'paused' as TimerStatus }
            : t,
        ),
      };

    case 'PLAY_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id) && (t.timerStatus === 'paused' || t.timerStatus === 'idle')
            ? { ...t, timerStatus: 'running' as TimerStatus }
            : t,
        ),
      };

    case 'RESET_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? { ...t, remainingSec: t.originalDurationSec, timerStatus: 'idle' as TimerStatus }
            : t,
        ),
      };

    case 'MARK_DONE_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? { ...t, status: 'done' as TaskStatus, timerStatus: 'paused' as TimerStatus }
            : t,
        ),
        selectedIds: new Set(),
      };

    case 'ARCHIVE_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? { ...t, status: 'archived' as TaskStatus, timerStatus: 'paused' as TimerStatus }
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
  filteredTasks: Task[];
  dispatch: React.Dispatch<TaskAction>;
  addTask: (input: CreateTaskInput) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTimer: (id: string) => void;
  resetTimer: (id: string) => void;
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
  const [savedTasks, setSavedTasks, isSavedTasksHydrated] = useLocalStorage<Task[]>('timetag-tasks', []);

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
      dispatch({ type: 'SET_TASKS', payload: savedTasks });
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
  const filteredTasks = useMemo(
    () =>
      applyPipeline(state.tasks, {
        workspace: state.workspace,
        filter: state.filter,
        sort: state.sort,
        searchQuery: state.searchQuery,
      }),
    [state],
  );

  // Convenience dispatchers
  const addTask = useCallback((input: CreateTaskInput) => dispatch({ type: 'ADD_TASK', payload: input }), []);
  const updateTask = useCallback((id: string, updates: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', payload: { id, updates } }), []);
  const deleteTask = useCallback((id: string) => dispatch({ type: 'DELETE_TASK', payload: id }), []);
  const toggleTimer = useCallback((id: string) => dispatch({ type: 'TOGGLE_TIMER', payload: { id, nowIso: new Date().toISOString() } }), [],);
  const resetTimer = useCallback((id: string) => dispatch({ type: 'RESET_TIMER', payload: { id, nowIso: new Date().toISOString() } }), [],);
  const setWorkspace = useCallback((ws: WorkspaceType) => dispatch({ type: 'SET_WORKSPACE', payload: ws }), []);
  const setFilter = useCallback((f: Partial<FilterState>) => dispatch({ type: 'SET_FILTER', payload: f }), []);
  const setSort = useCallback((s: SortState) => dispatch({ type: 'SET_SORT', payload: s }), []);
  const setSearch = useCallback((q: string) => dispatch({ type: 'SET_SEARCH', payload: q }), []);
  const toggleSelect = useCallback((id: string) => dispatch({ type: 'TOGGLE_SELECT', payload: id }), []);
  const selectAll = useCallback(() => dispatch({ type: 'SELECT_ALL' }), []);
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []);
  const deleteSelected = useCallback(() => dispatch({ type: 'DELETE_SELECTED' }), []);
  const pauseSelected = useCallback(() => dispatch({ type: 'PAUSE_SELECTED' }), []);
  const playSelected = useCallback(() => dispatch({ type: 'PLAY_SELECTED' }), []);
  const resetSelected = useCallback(() => dispatch({ type: 'RESET_SELECTED' }), []);
  const markDoneSelected = useCallback(() => dispatch({ type: 'MARK_DONE_SELECTED' }), []);
  const archiveSelected = useCallback(() => dispatch({ type: 'ARCHIVE_SELECTED' }), []);
  const undoDelete = useCallback(() => dispatch({ type: 'UNDO_DELETE' }), []);

  const value: TaskContextValue = {
    state,
    filteredTasks,
    dispatch,
    addTask,
    updateTask,
    deleteTask,
    toggleTimer,
    resetTimer,
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

