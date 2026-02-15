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
} from '@/types';
import { useLocalStorage } from '@/hooks';
import { generateId, getUrgencyLevel, isApproachingRed } from '@/utils';

// ============================================================================
// State Types
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
// Action Types
// ============================================================================

type TaskAction =
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: CreateTaskInput }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task> } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'DELETE_SELECTED' }
  | { type: 'TOGGLE_TIMER'; payload: string }
  | { type: 'RESET_TIMER'; payload: string }
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
// Initial State
// ============================================================================

const initialFilter: FilterState = {
  status: 'all',
  urgency: {
    green: true,
    yellow: true,
    red: true,
    overdue: true,
  },
  approachingRed: {
    enabled: false,
    windowMinutes: 10,
  },
};

const initialSort: SortState = {
  field: 'createdAt',
  direction: 'desc',
};

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
// Reducer
// ============================================================================

function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();
  const defaultDuration = 25 * 60; // 25 minutes default (Pomodoro)
  const durationSec = input.durationSec ?? defaultDuration;

  return {
    id: generateId(),
    title: input.title,
    workspace: input.workspace ?? 'work',
    status: 'active',
    deadlineMode: input.deadlineMode ?? 'duration',
    targetAt: input.targetAt,
    remainingSec: durationSec,
    originalDurationSec: durationSec,
    timerStatus: 'idle',
    createdAt: now,
    updatedAt: now,
  };
}

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'ADD_TASK': {
      const newTask = createTask(action.payload);
      return {
        ...state,
        tasks: [newTask, ...state.tasks],
      };
    }

    case 'UPDATE_TASK': {
      const { id, updates } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id
            ? { ...task, ...updates, updatedAt: new Date().toISOString() }
            : task
        ),
      };
    }

    case 'DELETE_TASK': {
      const taskToDelete = state.tasks.find((t) => t.id === action.payload);
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.payload),
        undoStack: taskToDelete ? [taskToDelete] : null,
        selectedIds: new Set(
          [...state.selectedIds].filter((id) => id !== action.payload)
        ),
      };
    }

    case 'DELETE_SELECTED': {
      const selectedTasks = state.tasks.filter((t) =>
        state.selectedIds.has(t.id)
      );
      return {
        ...state,
        tasks: state.tasks.filter((task) => !state.selectedIds.has(task.id)),
        undoStack: selectedTasks.length > 0 ? selectedTasks : null,
        selectedIds: new Set(),
      };
    }

    case 'TOGGLE_TIMER': {
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.payload) return task;

          let newStatus: TimerStatus;
          if (task.timerStatus === 'running') {
            newStatus = 'paused';
          } else if (task.timerStatus === 'expired') {
            newStatus = 'expired';
          } else {
            newStatus = 'running';
          }

          return {
            ...task,
            timerStatus: newStatus,
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case 'RESET_TIMER': {
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.payload) return task;

          return {
            ...task,
            remainingSec: task.originalDurationSec,
            timerStatus: 'idle',
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }

    case 'TICK_TIMERS': {
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.timerStatus !== 'running') return task;

          const newRemaining = task.remainingSec - 1;
          const isExpired = newRemaining <= 0;

          return {
            ...task,
            remainingSec: newRemaining,
            timerStatus: isExpired ? 'expired' : 'running',
          };
        }),
      };
    }

    case 'SET_WORKSPACE':
      return { ...state, workspace: action.payload, selectedIds: new Set() };

    case 'SET_FILTER':
      return { ...state, filter: { ...state.filter, ...action.payload } };

    case 'SET_SORT':
      return { ...state, sort: action.payload };

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };

    case 'TOGGLE_SELECT': {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      return { ...state, selectedIds: newSelected };
    }

    case 'SELECT_ALL': {
      const visibleIds = getFilteredTasks(state).map((t) => t.id);
      return { ...state, selectedIds: new Set(visibleIds) };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set() };

    case 'PAUSE_SELECTED': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          state.selectedIds.has(task.id) && task.timerStatus === 'running'
            ? { ...task, timerStatus: 'paused' as TimerStatus }
            : task
        ),
      };
    }

    case 'PLAY_SELECTED': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          state.selectedIds.has(task.id) &&
          (task.timerStatus === 'paused' || task.timerStatus === 'idle')
            ? { ...task, timerStatus: 'running' as TimerStatus }
            : task
        ),
      };
    }

    case 'RESET_SELECTED': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          state.selectedIds.has(task.id)
            ? {
                ...task,
                remainingSec: task.originalDurationSec,
                timerStatus: 'idle' as TimerStatus,
              }
            : task
        ),
      };
    }

    case 'MARK_DONE_SELECTED': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          state.selectedIds.has(task.id)
            ? {
                ...task,
                status: 'done' as TaskStatus,
                timerStatus: 'paused' as TimerStatus,
              }
            : task
        ),
        selectedIds: new Set(),
      };
    }

    case 'ARCHIVE_SELECTED': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          state.selectedIds.has(task.id)
            ? {
                ...task,
                status: 'archived' as TaskStatus,
                timerStatus: 'paused' as TimerStatus,
              }
            : task
        ),
        selectedIds: new Set(),
      };
    }

    case 'UNDO_DELETE': {
      if (!state.undoStack) return state;
      return {
        ...state,
        tasks: [...state.undoStack, ...state.tasks],
        undoStack: null,
      };
    }

    default:
      return state;
  }
}

// ============================================================================
// Filter Helper
// ============================================================================

function getFilteredTasks(state: TaskState): Task[] {
  let tasks = state.tasks;

  // Filter by workspace
  if (state.workspace !== 'all') {
    tasks = tasks.filter((t) => t.workspace === state.workspace);
  }

  // Filter by status
  if (state.filter.status !== 'all') {
    tasks = tasks.filter((t) => t.status === state.filter.status);
  }

  // Filter by urgency
  tasks = tasks.filter((t) => {
    const urgency = getUrgencyLevel(t);
    return state.filter.urgency[urgency];
  });

  // Filter by approaching red (if enabled)
  if (state.filter.approachingRed.enabled) {
    tasks = tasks.filter(
      (t) =>
        isApproachingRed(t, state.filter.approachingRed.windowMinutes) ||
        getUrgencyLevel(t) === 'red' ||
        getUrgencyLevel(t) === 'overdue'
    );
  }

  // Filter by search query
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase();
    tasks = tasks.filter((t) => t.title.toLowerCase().includes(query));
  }

  // Sort
  tasks = [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (state.sort.field) {
      case 'createdAt':
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        comparison =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'remainingSec':
        comparison = a.remainingSec - b.remainingSec;
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }

    return state.sort.direction === 'asc' ? comparison : -comparison;
  });

  return tasks;
}

// ============================================================================
// Context
// ============================================================================

interface TaskContextValue {
  state: TaskState;
  filteredTasks: Task[];
  dispatch: React.Dispatch<TaskAction>;
  // Convenience methods
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

interface TaskProviderProps {
  children: React.ReactNode;
}

export function TaskProvider({ children }: TaskProviderProps) {
  const [savedTasks, setSavedTasks] = useLocalStorage<Task[]>(
    'timetag-tasks',
    []
  );
  const [state, dispatch] = useReducer(taskReducer, {
    ...initialState,
    tasks: savedTasks,
  });

  // Sync tasks to localStorage
  useEffect(() => {
    setSavedTasks(state.tasks);
  }, [state.tasks, setSavedTasks]);

  // Load saved tasks on mount
  useEffect(() => {
    if (savedTasks.length > 0 && state.tasks.length === 0) {
      dispatch({ type: 'SET_TASKS', payload: savedTasks });
    }
  }, [savedTasks, state.tasks.length]);

  // Timer tick effect
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRunningTimers = state.tasks.some((t) => t.timerStatus === 'running');

  useEffect(() => {
    if (hasRunningTimers) {
      timerRef.current = setInterval(() => {
        dispatch({ type: 'TICK_TIMERS' });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hasRunningTimers]);

  // Memoized filtered tasks
  const filteredTasks = useMemo(() => getFilteredTasks(state), [state]);

  // Convenience methods
  const addTask = useCallback((input: CreateTaskInput) => {
    dispatch({ type: 'ADD_TASK', payload: input });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { id, updates } });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TASK', payload: id });
  }, []);

  const toggleTimer = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_TIMER', payload: id });
  }, []);

  const resetTimer = useCallback((id: string) => {
    dispatch({ type: 'RESET_TIMER', payload: id });
  }, []);

  const setWorkspace = useCallback((workspace: WorkspaceType) => {
    dispatch({ type: 'SET_WORKSPACE', payload: workspace });
  }, []);

  const setFilter = useCallback((filter: Partial<FilterState>) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const setSort = useCallback((sort: SortState) => {
    dispatch({ type: 'SET_SORT', payload: sort });
  }, []);

  const setSearch = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', payload: query });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECT', payload: id });
  }, []);

  const selectAll = useCallback(() => {
    dispatch({ type: 'SELECT_ALL' });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const deleteSelected = useCallback(() => {
    dispatch({ type: 'DELETE_SELECTED' });
  }, []);

  const pauseSelected = useCallback(() => {
    dispatch({ type: 'PAUSE_SELECTED' });
  }, []);

  const playSelected = useCallback(() => {
    dispatch({ type: 'PLAY_SELECTED' });
  }, []);

  const resetSelected = useCallback(() => {
    dispatch({ type: 'RESET_SELECTED' });
  }, []);

  const markDoneSelected = useCallback(() => {
    dispatch({ type: 'MARK_DONE_SELECTED' });
  }, []);

  const archiveSelected = useCallback(() => {
    dispatch({ type: 'ARCHIVE_SELECTED' });
  }, []);

  const undoDelete = useCallback(() => {
    dispatch({ type: 'UNDO_DELETE' });
  }, []);

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
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}


