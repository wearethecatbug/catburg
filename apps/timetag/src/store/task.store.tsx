'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Task,
  TaskStatus,
  WorkspaceType,
  CreateTaskInput,
  FilterState,
  SortState,
} from '@/domain/task.types';
import { applyPipeline } from '@/domain/task.pipeline';
import {
  getDeadlineRemainingSec,
  getActivePomodoroConfig,
  toggleTimerState,
  resetTimerState,
  shouldTickTimer,
  tickTimer,
} from '@/domain/timer.logic';
import { generateId } from '@/domain/helpers';
import { useTaskPersistence, type TaskPersistenceStatus } from './task.persistence';

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
  | { type: 'REPLACE_PERSISTED_TASKS'; payload: Task[]; clearSelection: boolean }
  | { type: 'ADD_TASK'; payload: CreateTaskInput }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task>; nowIso: string } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'DELETE_SELECTED' }
  | { type: 'TOGGLE_TIMER'; payload: { id: string; nowIso: string } }
  | { type: 'RESET_TIMER'; payload: { id: string; nowIso: string } }
  | { type: 'TICK_TIMERS'; payload: { nowIso: string } }
  | { type: 'SET_WORKSPACE'; payload: WorkspaceType }
  | { type: 'SET_FILTER'; payload: Partial<FilterState> }
  | { type: 'SET_SORT'; payload: SortState }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'TOGGLE_SELECT'; payload: string }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'PAUSE_SELECTED'; payload: { nowIso: string } }
  | { type: 'PLAY_SELECTED'; payload: { nowIso: string } }
  | { type: 'RESET_SELECTED'; payload: { nowIso: string } }
  | { type: 'MARK_DONE_SELECTED'; payload: { nowIso: string } }
  | { type: 'ARCHIVE_SELECTED'; payload: { nowIso: string } }
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

const nonPersistentActionTypes = new Set<TaskAction['type']>([
  'REPLACE_PERSISTED_TASKS',
  'TICK_TIMERS',
  'SET_WORKSPACE',
  'SET_FILTER',
  'SET_SORT',
  'SET_SEARCH',
  'TOGGLE_SELECT',
  'SELECT_ALL',
  'CLEAR_SELECTION',
]);

// ============================================================================
// Task Factory
// ============================================================================

function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();

  // For deadline mode: calculate remainingSec from targetAt
  // For other modes: use durationSec with default fallback
  const timerMode = input.timerMode ?? 'duration';
  const isDeadlineMode = timerMode === 'deadline';
  const pomodoro = timerMode === 'pomodoro'
    ? getActivePomodoroConfig(input.pomodoro)
    : null;

  let durationSec: number;
  if (isDeadlineMode) {
    // Calculate remaining seconds from targetAt to now
    durationSec = getDeadlineRemainingSec(input.targetAt, now, false) ?? 0;
  } else if (pomodoro) {
    durationSec = pomodoro.workDurationMin * 60;
  } else {
    durationSec = input.durationSec ?? 25 * 60;
  }

  const timerControls = input.timerControls ?? {
    autoStart: pomodoro?.autoStart ?? false,
    autoPlay: false,
    autoReset: false,
    allowOverdue: false,
  };
  const shouldAutoStart = input.timerControls?.autoStart ?? pomodoro?.autoStart ?? false;

  return {
    id: generateId(),
    title: input.title,
    workspace: input.workspace === 'all' ? 'work' : (input.workspace ?? 'work'),
    status: 'active',
    timerMode,
    targetAt: input.targetAt,
    remainingSec: durationSec,
    originalDurationSec: durationSec,
    timerStatus: shouldAutoStart ? 'running' : 'idle',
    lastTimerUpdateAt: shouldAutoStart && !isDeadlineMode ? now : undefined,
    timerControls,
    pomodoro: pomodoro
      ? { ...pomodoro, currentCycle: 0, isBreak: false }
      : input.pomodoro,
    reminders: input.reminders ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function freezeTask(task: Task, status: TaskStatus, nowIso: string): Task {
  const deadlineAt = task.targetAt ? new Date(task.targetAt).getTime() : Number.NaN;
  const shouldReconcileDeadline =
    task.timerMode === 'deadline' && task.status === 'active' && Number.isFinite(deadlineAt);
  const timerPatch =
    task.timerStatus === 'running'
      ? toggleTimerState(task, nowIso)
      : shouldReconcileDeadline
        ? tickTimer(task, nowIso) ?? {}
        : {};

  return {
    ...task,
    ...timerPatch,
    status,
    timerStatus:
      task.timerStatus === 'expired' || timerPatch.timerStatus === 'expired' ? 'expired' : 'paused',
    lastTimerUpdateAt: undefined,
    updatedAt: nowIso,
  };
}

function isRunnableTask(task: Task): boolean {
  return task.status === 'active';
}

// ============================================================================
// Reducer (delegates to domain functions)
// ============================================================================

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'REPLACE_PERSISTED_TASKS': {
      const visibleIds = new Set(applyPipeline(action.payload, {
        workspace: state.workspace,
        filter: state.filter,
        sort: state.sort,
        searchQuery: state.searchQuery,
      }).map((task) => task.id));
      return {
        ...state,
        tasks: action.payload,
        selectedIds: action.clearSelection
          ? new Set()
          : new Set([...state.selectedIds].filter((id) => visibleIds.has(id))),
        undoStack: null,
      };
    }

    case 'ADD_TASK':
      return { ...state, tasks: [createTask(action.payload), ...state.tasks] };

    case 'UPDATE_TASK': {
      const { id, updates, nowIso } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          if (!updates.status || updates.status === 'active') {
            const updatedTask = { ...t, ...updates, updatedAt: nowIso };
            if (
              updates.status === 'active' &&
              !isRunnableTask(t) &&
              updatedTask.timerStatus === 'running' &&
              updatedTask.timerMode !== 'deadline'
            ) {
              return { ...updatedTask, lastTimerUpdateAt: nowIso };
            }
            return updatedTask;
          }

          const frozen = freezeTask(t, updates.status, nowIso);
          return {
            ...frozen,
            ...updates,
            timerStatus: frozen.timerStatus,
            lastTimerUpdateAt: undefined,
            updatedAt: nowIso,
          };
        }),
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
            t.id === action.payload.id && isRunnableTask(t)
              ? { ...t, ...toggleTimerState(t, action.payload.nowIso) }
              : t,
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
          if (!isRunnableTask(t)) return t;
          const patch = tickTimer(t, action.payload.nowIso);
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
          state.selectedIds.has(t.id) && isRunnableTask(t) && t.timerStatus === 'running'
            ? { ...t, ...toggleTimerState(t, action.payload.nowIso) }
            : t,
        ),
      };

    case 'PLAY_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id) && isRunnableTask(t) && (t.timerStatus === 'paused' || t.timerStatus === 'idle')
            ? { ...t, ...toggleTimerState(t, action.payload.nowIso) }
            : t,
        ),
      };

    case 'RESET_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? { ...t, ...resetTimerState(t, action.payload.nowIso) }
            : t,
        ),
      };

    case 'MARK_DONE_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? freezeTask(t, 'done', action.payload.nowIso)
            : t,
        ),
        selectedIds: new Set(),
      };

    case 'ARCHIVE_SELECTED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          state.selectedIds.has(t.id)
            ? freezeTask(t, 'archived', action.payload.nowIso)
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
  persistence: TaskPersistenceStatus;
  retryPersistence: () => void;
  reloadPersistedTasks: () => void;
  recoverPersistedTasks: () => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const stateRef = useRef<TaskState>(initialState);
  const applyExternalRef = useRef<(tasks: Task[], clearSelection: boolean) => void>(() => {});
  const applyExternal = useCallback((tasks: Task[], clearSelection: boolean) => applyExternalRef.current(tasks, clearSelection), []);
  const {
    persistence,
    registerLocalSnapshot,
    persist,
    retry: retryPersistence,
    reload: reloadPersistedTasks,
    recover: recoverPersistedTasks,
  } = useTaskPersistence(applyExternal);

  // Always initialize with empty tasks to avoid hydration mismatch. stateRef is
  // the synchronous transition owner; React state is its single publication.
  const [state, setState] = useState<TaskState>(initialState);

  const applyAction = useCallback((action: TaskAction, persistTasks: boolean) => {
    const previous = stateRef.current;
    const next = taskReducer(previous, action);
    if (next === previous) return;

    stateRef.current = next;
    setState(next);
    if (persistTasks && JSON.stringify(next.tasks) !== JSON.stringify(previous.tasks)) {
      registerLocalSnapshot(next.tasks);
      persist();
    }
  }, [persist, registerLocalSnapshot]);

  // Accept an external snapshot through the same synchronous owner before the
  // persistence layer advances its confirmed raw baseline.
  applyExternalRef.current = (tasks, clearSelection) => {
    const nowIso = new Date().toISOString();
    const reconciledTasks = tasks.map((task) => (
      isRunnableTask(task) && shouldTickTimer(task)
        ? { ...task, ...(tickTimer(task, nowIso) ?? {}) }
        : task
    ));
    applyAction({ type: 'REPLACE_PERSISTED_TASKS', payload: reconciledTasks, clearSelection }, false);
  };

  const dispatchWithIntent = useCallback((action: TaskAction) => {
    applyAction(action, !nonPersistentActionTypes.has(action.type));
  }, [applyAction]);

  // Timer tick engine
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const needsClock = state.tasks.some((task) => isRunnableTask(task) && shouldTickTimer(task));

  useEffect(() => {
    if (needsClock) {
      timerRef.current = setInterval(
        () => dispatchWithIntent({ type: 'TICK_TIMERS', payload: { nowIso: new Date().toISOString() } }),
        1000,
      );
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [dispatchWithIntent, needsClock]);

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
  const addTask = useCallback((input: CreateTaskInput) => dispatchWithIntent({ type: 'ADD_TASK', payload: input }), [dispatchWithIntent]);
  const updateTask = useCallback((id: string, updates: Partial<Task>) => dispatchWithIntent({ type: 'UPDATE_TASK', payload: { id, updates, nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const deleteTask = useCallback((id: string) => dispatchWithIntent({ type: 'DELETE_TASK', payload: id }), [dispatchWithIntent]);
  const toggleTimer = useCallback((id: string) => dispatchWithIntent({ type: 'TOGGLE_TIMER', payload: { id, nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const resetTimer = useCallback((id: string) => dispatchWithIntent({ type: 'RESET_TIMER', payload: { id, nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const setWorkspace = useCallback((ws: WorkspaceType) => dispatchWithIntent({ type: 'SET_WORKSPACE', payload: ws }), [dispatchWithIntent]);
  const setFilter = useCallback((f: Partial<FilterState>) => dispatchWithIntent({ type: 'SET_FILTER', payload: f }), [dispatchWithIntent]);
  const setSort = useCallback((s: SortState) => dispatchWithIntent({ type: 'SET_SORT', payload: s }), [dispatchWithIntent]);
  const setSearch = useCallback((q: string) => dispatchWithIntent({ type: 'SET_SEARCH', payload: q }), [dispatchWithIntent]);
  const toggleSelect = useCallback((id: string) => dispatchWithIntent({ type: 'TOGGLE_SELECT', payload: id }), [dispatchWithIntent]);
  const selectAll = useCallback(() => dispatchWithIntent({ type: 'SELECT_ALL' }), [dispatchWithIntent]);
  const clearSelection = useCallback(() => dispatchWithIntent({ type: 'CLEAR_SELECTION' }), [dispatchWithIntent]);
  const deleteSelected = useCallback(() => dispatchWithIntent({ type: 'DELETE_SELECTED' }), [dispatchWithIntent]);
  const pauseSelected = useCallback(() => dispatchWithIntent({ type: 'PAUSE_SELECTED', payload: { nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const playSelected = useCallback(() => dispatchWithIntent({ type: 'PLAY_SELECTED', payload: { nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const resetSelected = useCallback(() => dispatchWithIntent({ type: 'RESET_SELECTED', payload: { nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const markDoneSelected = useCallback(() => dispatchWithIntent({ type: 'MARK_DONE_SELECTED', payload: { nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const archiveSelected = useCallback(() => dispatchWithIntent({ type: 'ARCHIVE_SELECTED', payload: { nowIso: new Date().toISOString() } }), [dispatchWithIntent]);
  const undoDelete = useCallback(() => dispatchWithIntent({ type: 'UNDO_DELETE' }), [dispatchWithIntent]);

  const value: TaskContextValue = {
    state,
    filteredTasks,
    dispatch: dispatchWithIntent,
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
    persistence,
    retryPersistence,
    reloadPersistedTasks,
    recoverPersistedTasks,
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

