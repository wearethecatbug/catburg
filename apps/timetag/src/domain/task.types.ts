// ============================================================================
// Task Status
// ============================================================================
export type TaskStatus = 'active' | 'done' | 'archived';

// ============================================================================
// Timer Status (state machine states)
// ============================================================================
export type TimerStatus = 'running' | 'paused' | 'idle' | 'expired';

// ============================================================================
// Timer Mode
// ============================================================================
export type TimerMode = 'duration' | 'pomodoro' | 'deadline';

// ============================================================================
// Urgency Level (derived from remaining time)
// ============================================================================
export type UrgencyLevel = 'normal' | 'warn' | 'danger' | 'overdue';

// ============================================================================
// Workspace
// ============================================================================
export type WorkspaceType = 'work' | 'home' | 'all';

// ============================================================================
// Timer Controls
// ============================================================================
export interface TimerControls {
  autoStart: boolean;
  autoPlay: boolean;
  autoReset: boolean;
  allowOverdue: boolean;
}

// ============================================================================
// Pomodoro Config
// ============================================================================
export interface PomodoroConfig {
  cycles: number;
  workDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  currentCycle?: number;
  isBreak?: boolean;
  autoStart?: boolean;
  autoPlay?: boolean;
}

// ============================================================================
// Reminder
// ============================================================================
export interface Reminder {
  id: string;
  enabled: boolean;
}

// ============================================================================
// Task Entity
// ============================================================================
export interface Task {
  id: string;
  title: string;
  workspace: WorkspaceType;
  status: TaskStatus;
  timerMode: TimerMode;
  /** Target time as ISO string (for deadline mode) */
  targetAt?: string;
  /** Remaining seconds (for duration mode) */
  remainingSec: number;
  /** Original duration in seconds (for reset) */
  originalDurationSec: number;
  timerStatus: TimerStatus;
  timerControls?: TimerControls;
  pomodoro?: PomodoroConfig;
  reminders: Reminder[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Task Creation Input
// ============================================================================
export interface CreateTaskInput {
  title: string;
  workspace?: WorkspaceType;
  timerMode?: TimerMode;
  targetAt?: string;
  durationSec?: number;
  timerControls?: TimerControls;
  pomodoro?: PomodoroConfig;
  reminders?: Reminder[];
}

// ============================================================================
// Filter State
// ============================================================================
export interface FilterState {
  status: TaskStatus | 'all';
  urgency: {
    normal: boolean;
    warn: boolean;
    danger: boolean;
    overdue: boolean;
  };
  approachingRed: {
    enabled: boolean;
    windowMinutes: 5 | 10 | 30;
  };
  mode: {
    duration: boolean;
    pomodoro: boolean;
    deadline: boolean;
  };
  hasReminders?: 'any' | 'yes' | 'no';
}

// ============================================================================
// Sort Options
// ============================================================================
export type SortField = 'createdAt' | 'updatedAt' | 'remainingSec' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}
