// Task Status
export type TaskStatus = 'active' | 'done' | 'archived';

// Timer Status
export type TimerStatus = 'running' | 'paused' | 'idle' | 'expired';

// Deadline Mode
export type DeadlineMode = 'duration' | 'deadline';

// Urgency Level (based on remaining time)
export type UrgencyLevel = 'green' | 'yellow' | 'red' | 'overdue';

// Workspace Type
export type WorkspaceType = 'work' | 'home' | 'all';

// Task Interface
export interface Task {
  id: string;
  title: string;
  workspace: WorkspaceType;
  status: TaskStatus;
  deadlineMode: DeadlineMode;
  /** Target time as ISO string (for deadline mode) */
  targetAt?: string;
  /** Remaining seconds (for duration mode) */
  remainingSec: number;
  /** Original duration in seconds (for reset) */
  originalDurationSec: number;
  timerStatus: TimerStatus;
  createdAt: string;
  updatedAt: string;
  /** Selection state for bulk actions */
  selected?: boolean;
}

// Task Creation Input
export interface CreateTaskInput {
  title: string;
  workspace?: WorkspaceType;
  deadlineMode?: DeadlineMode;
  targetAt?: string;
  durationSec?: number;
}

// Filter State
export interface FilterState {
  status: TaskStatus | 'all';
  urgency: {
    green: boolean;
    yellow: boolean;
    red: boolean;
    overdue: boolean;
  };
  approachingRed: {
    enabled: boolean;
    windowMinutes: 5 | 10 | 30;
  };
}

// Sort Options
export type SortField = 'createdAt' | 'updatedAt' | 'remainingSec' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

