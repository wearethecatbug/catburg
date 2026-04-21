import type { AppSettings } from '@/domain/settings.types';

export const TASKS_STORAGE_KEY = 'timetag-tasks';
export const SETTINGS_STORAGE_KEY = 'timetag-settings';

export type StoredTask = {
  id: string;
  title: string;
  note?: string;
  workspace: string;
  status: 'active' | 'done' | 'archived';
  priority: 'normal' | 'urgent';
  timerMode: 'duration' | 'pomodoro' | 'deadline' | 'note';
  targetAt?: string;
  remainingSec: number;
  originalDurationSec: number;
  timerStatus: 'running' | 'paused' | 'idle' | 'expired';
  timerControls?: {
    autoStart: boolean;
    autoPlay: boolean;
    autoReset: boolean;
    allowOverdue: boolean;
  };
  reminders: Array<{ id: string; enabled: boolean }>;
  createdAt: string;
  updatedAt: string;
};

export const testSettings: AppSettings = {
  version: 3,
  general: {
    autoStartTimerWhenTaskCreated: false,
    autoPauseOtherTimers: false,
    confirmBeforeDelete: false,
    defaultWorkspace: 'work',
    defaultTaskView: 'all',
    showCompletedTasks: true,
    showUrgencyIndicator: true,
    showNotePreviewsInTaskList: true,
  },
  timer: {
    defaultMode: 'duration',
    allowMultipleTimers: true,
    overtimeBehavior: 'continue',
    showSecondsInTimer: false,
    durationDefaults: {
      presetId: '25',
      durationSec: 1500,
    },
    pomodoroDefaults: {
      presetId: 'classic',
      cycles: 1,
      workDurationMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
    },
    deadlineDefaults: {
      presetId: '1d',
      offsetSec: 86400,
    },
    hiddenDurationPresetIds: [],
    hiddenPomodoroPresetIds: [],
    hiddenDeadlinePresetIds: [],
  },
  appearance: {
    themeMode: 'light',
    customTheme: {
      presetId: 'airy-glass',
      overrides: {},
    },
    compactList: false,
    animationsEnabled: true,
    roundedCorners: 12,
    ringThickness: 3,
  },
};

const ISO_NOW = '2026-04-02T09:00:00.000Z';

function createTask(overrides: Partial<StoredTask> & Pick<StoredTask, 'id' | 'title'>): StoredTask {
  const { id, title, ...rest } = overrides;

  return {
    id,
    title,
    workspace: 'work',
    status: 'active',
    priority: 'normal',
    timerMode: 'duration',
    remainingSec: 1500,
    originalDurationSec: 1500,
    timerStatus: 'idle',
    timerControls: {
      autoStart: false,
      autoPlay: false,
      autoReset: false,
      allowOverdue: false,
    },
    reminders: [],
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
    ...rest,
  };
}

export const seededTasks: StoredTask[] = [
  createTask({
    id: 'task-urgent-note',
    title: 'Urgent note task',
    note: 'Important follow-up note',
    priority: 'urgent',
    remainingSec: 600,
    originalDurationSec: 1800,
    timerStatus: 'running',
  }),
  createTask({
    id: 'task-completed-note',
    title: 'Completed task with note',
    note: 'Completed note content',
    status: 'done',
    timerStatus: 'paused',
    remainingSec: 1200,
    originalDurationSec: 1800,
  }),
  createTask({
    id: 'task-plain',
    title: 'Plain task',
    remainingSec: 1800,
    originalDurationSec: 1800,
  }),
  createTask({
    id: 'task-urgent-plain',
    title: 'Urgent plain task',
    priority: 'urgent',
    remainingSec: 900,
    originalDurationSec: 1800,
  }),
];


