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
export type TimerMode = 'duration' | 'pomodoro' | 'deadline' | 'note';

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';

export type TimerAudioEvent =
  | 'workFinished'
  | 'shortBreakStarted'
  | 'shortBreakFinished'
  | 'longBreakStarted'
  | 'longBreakFinished'
  | 'pomodoroSessionFinished';

export type TimerDisplayTone = 'neutral' | 'focus' | 'break' | 'longBreak' | 'overdue' | 'finished';

// ============================================================================
// Urgency Level (derived from remaining time)
// ============================================================================
export type UrgencyLevel = 'normal' | 'warn' | 'danger' | 'overdue';

// ============================================================================
// Priority
// ============================================================================
export type TaskPriority = 'normal' | 'urgent';

export const TASK_NOTE_MAX_LENGTH = 280;

// ============================================================================
// Workspace
// ============================================================================
export type DefaultWorkspaceType = 'work' | 'home';
// Keep predefined tabs while allowing user-created workspace ids.
export type WorkspaceType = 'all' | DefaultWorkspaceType | (string & {});
export type AssignableWorkspaceType = Exclude<WorkspaceType, 'all'>;

// ============================================================================
// Timer Controls
// ============================================================================
export interface TimerControls {
  autoStart: boolean;
  autoPlay: boolean;
  autoReset: boolean;
  allowOverdue: boolean;
}

export interface TimerBehaviorOverride {
  doubleClickRestartEnabled?: boolean;
  autoStartAfterDoubleClickRestart?: boolean;
}

// ============================================================================
// Pomodoro Config
// ============================================================================
export interface PomodoroConfig {
  cycles: number;
  workDurationSec: number;
  shortBreakDurationSec: number;
  longBreakDurationSec: number;
  autoStartBreak?: boolean;
  autoStartNextWork?: boolean;
  workDurationMin?: number;
  shortBreakMin?: number;
  longBreakMin?: number;
}

export interface PomodoroSessionState {
  phase: PomodoroPhase;
  cycleIndex: number;
  totalCycles: number;
  completedWorkCycles: number;
  completedShortBreaks: number;
  currentPhaseDurationSec: number;
  remainingSec: number;
}

export interface TimerDisplayMeta {
  displayTime: string;
  displayMeta?: string;
  phase?: PomodoroPhase;
  tone: TimerDisplayTone;
  isPomodoro: boolean;
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
  note?: string;
  workspace: AssignableWorkspaceType;
  status: TaskStatus;
  priority: TaskPriority;
  timerMode: TimerMode;
  /** Target time as ISO string (for deadline mode) */
  targetAt?: string;
  /** Remaining seconds (for duration mode) */
  remainingSec: number;
  /** Original duration in seconds (for reset) */
  originalDurationSec: number;
  timerStatus: TimerStatus;
  timerControls?: TimerControls;
  timerBehaviorOverride?: TimerBehaviorOverride;
  pomodoro?: PomodoroConfig;
  pomodoroSession?: PomodoroSessionState;
  reminders: Reminder[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Task Creation Input
// ============================================================================
export interface CreateTaskInput {
  title: string;
  note?: string;
  workspace?: AssignableWorkspaceType;
  priority?: TaskPriority;
  timerMode?: TimerMode;
  targetAt?: string;
  durationSec?: number;
  timerControls?: TimerControls;
  timerBehaviorOverride?: TimerBehaviorOverride;
  pomodoro?: PomodoroConfig;
  pomodoroSession?: PomodoroSessionState;
  reminders?: Reminder[];
}

// ============================================================================
// Filter State
// ============================================================================
export type TaskStatusFilter = TaskStatus;

export interface FilterState {
  status: TaskStatusFilter;
  urgency: {
    normal: boolean;
    warn: boolean;
    danger: boolean;
    overdue: boolean;
  };
  priority: {
    normal: boolean;
    urgent: boolean;
  };
  approachingRed: {
    enabled: boolean;
    // User-configurable in app settings (not limited to preset chips).
    windowMinutes: number;
  };
  mode: {
    duration: boolean;
    pomodoro: boolean;
    deadline: boolean;
    note: boolean;
  };
  hasReminders?: 'any' | 'yes' | 'no';
}

// ============================================================================
// Sort Options
// ============================================================================
export type SortField = 'createdAt' | 'updatedAt' | 'remainingSec' | 'title' | 'priority';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}
