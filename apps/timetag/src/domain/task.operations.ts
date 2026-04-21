import type {
  AssignableWorkspaceType,
  CreateTaskInput,
  PomodoroConfig,
  Reminder,
  Task,
  TaskPriority,
  TaskStatus,
  TimerMode,
  TimerControls,
  TimerStatus,
} from './task.types';
import { TASK_NOTE_MAX_LENGTH } from './task.types';
import { generateId } from './helpers';
import { supportsTimer } from './task.mode';
import { normalizeTaskWorkspace } from './workspace';

const DEFAULT_TIMER_CONTROLS: TimerControls = {
  autoStart: false,
  autoPlay: false,
  autoReset: false,
  allowOverdue: false,
};

function createDefaultTimerControls(): TimerControls {
  return { ...DEFAULT_TIMER_CONTROLS };
}

function normalizeTimerControls(timerControls?: TimerControls): TimerControls {
  if (!timerControls) {
    return createDefaultTimerControls();
  }

  return {
    autoStart: Boolean(timerControls.autoStart),
    autoPlay: Boolean(timerControls.autoPlay),
    autoReset: Boolean(timerControls.autoReset),
    allowOverdue: Boolean(timerControls.allowOverdue),
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getDeadlineDurationSec(targetAt: string | undefined, nowIso: string): number {
  if (!targetAt) return 0;

  const targetTime = new Date(targetAt).getTime();
  const nowTime = new Date(nowIso).getTime();
  if (Number.isNaN(targetTime) || Number.isNaN(nowTime)) return 0;

  return Math.max(0, Math.floor((targetTime - nowTime) / 1000));
}

function normalizeTaskTiming(
  input: {
    timerMode: TimerMode;
    nowIso: string;
    targetAt?: string;
    durationSec?: number;
    remainingSec?: number;
    originalDurationSec?: number;
    timerStatus?: TimerStatus;
    timerControls?: TimerControls;
    pomodoro?: PomodoroConfig;
  },
): Pick<Task, 'timerMode' | 'targetAt' | 'remainingSec' | 'originalDurationSec' | 'timerStatus' | 'timerControls' | 'pomodoro'> {
  if (!supportsTimer(input.timerMode)) {
    return {
      timerMode: input.timerMode,
      targetAt: undefined,
      remainingSec: 0,
      originalDurationSec: 0,
      timerStatus: 'idle',
      timerControls: undefined,
      pomodoro: undefined,
    };
  }

  const timerControls = normalizeTimerControls(input.timerControls);
  const timerStatus = isTimerStatus(input.timerStatus)
    ? input.timerStatus
    : timerControls.autoStart
      ? 'running'
      : 'idle';

  if (input.timerMode === 'deadline') {
    const targetAt = typeof input.targetAt === 'string' ? input.targetAt : undefined;
    const derivedDurationSec = getDeadlineDurationSec(targetAt, input.nowIso);
    const originalDurationSec =
      isFiniteNumber(input.originalDurationSec) && input.originalDurationSec > 0
        ? Math.floor(input.originalDurationSec)
        : derivedDurationSec;
    const remainingSec = isFiniteNumber(input.remainingSec)
      ? Math.floor(input.remainingSec)
      : originalDurationSec;

    return {
      timerMode: input.timerMode,
      targetAt,
      remainingSec,
      originalDurationSec,
      timerStatus,
      timerControls,
      pomodoro: undefined,
    };
  }

  const fallbackDurationSec = input.timerMode === 'pomodoro'
    ? Math.max(1, Math.floor(input.pomodoro?.workDurationMin ?? 25)) * 60
    : isFiniteNumber(input.durationSec) && input.durationSec > 0
      ? Math.floor(input.durationSec)
      : 25 * 60;
  const originalDurationSec =
    isFiniteNumber(input.originalDurationSec) && input.originalDurationSec > 0
      ? Math.floor(input.originalDurationSec)
      : fallbackDurationSec;
  const remainingSec = isFiniteNumber(input.remainingSec)
    ? Math.floor(input.remainingSec)
    : originalDurationSec;

  return {
    timerMode: input.timerMode,
    targetAt: undefined,
    remainingSec,
    originalDurationSec,
    timerStatus,
    timerControls,
    pomodoro: input.timerMode === 'pomodoro' ? input.pomodoro : undefined,
  };
}

export function createTask(input: CreateTaskInput, nowIso: string): Task {
  const note = typeof input.note === 'string'
    ? input.note.trim().slice(0, TASK_NOTE_MAX_LENGTH)
    : '';
  const timerMode = input.timerMode ?? 'duration';
  const timing = normalizeTaskTiming({
    timerMode,
    nowIso,
    targetAt: input.targetAt,
    durationSec: input.durationSec,
    timerControls: input.timerControls,
    pomodoro: input.pomodoro,
  });

  const workspace: AssignableWorkspaceType = normalizeTaskWorkspace(input.workspace);

  return {
    id: generateId(),
    title: input.title,
    note: note || undefined,
    workspace,
    status: 'active',
    priority: input.priority ?? 'normal',
    ...timing,
    reminders: input.reminders ?? [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function pauseOtherRunningTasks(
  tasks: Task[],
  activeId: string,
  nowIso: string,
): Task[] {
  return tasks.map((task) => (
    task.id !== activeId && supportsTimer(task.timerMode) && task.timerStatus === 'running'
      ? { ...task, timerStatus: 'paused' as TimerStatus, updatedAt: nowIso }
      : task
  ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'active' || value === 'done' || value === 'archived';
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return value === 'normal' || value === 'urgent';
}

function isTimerMode(value: unknown): value is TimerMode {
  return value === 'duration' || value === 'pomodoro' || value === 'deadline' || value === 'note';
}

function isTimerStatus(value: unknown): value is TimerStatus {
  return value === 'running' || value === 'paused' || value === 'idle' || value === 'expired';
}

function isPomodoroConfig(value: unknown): value is PomodoroConfig {
  if (!isRecord(value)) return false;

  return (
    typeof value.cycles === 'number' &&
    Number.isFinite(value.cycles) &&
    typeof value.workDurationMin === 'number' &&
    Number.isFinite(value.workDurationMin) &&
    typeof value.shortBreakMin === 'number' &&
    Number.isFinite(value.shortBreakMin) &&
    typeof value.longBreakMin === 'number' &&
    Number.isFinite(value.longBreakMin)
  );
}

function isReminder(value: unknown): value is Reminder {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.enabled === 'boolean';
}

export function normalizeHydratedTasks(tasks: unknown[], nowIso: string = new Date().toISOString()): Task[] {
  return tasks.flatMap((raw) => {
    if (!isRecord(raw)) return [];

    const note = typeof raw.note === 'string'
      ? raw.note.trim().slice(0, TASK_NOTE_MAX_LENGTH)
      : '';
    const timerMode = isTimerMode(raw.timerMode) ? raw.timerMode : 'duration';
    const timing = normalizeTaskTiming({
      timerMode,
      nowIso,
      targetAt: typeof raw.targetAt === 'string' ? raw.targetAt : undefined,
      remainingSec: isFiniteNumber(raw.remainingSec) ? raw.remainingSec : undefined,
      originalDurationSec: isFiniteNumber(raw.originalDurationSec) ? raw.originalDurationSec : undefined,
      timerStatus: isTimerStatus(raw.timerStatus) ? raw.timerStatus : undefined,
      timerControls: isRecord(raw.timerControls)
        ? {
            autoStart: Boolean(raw.timerControls.autoStart),
            autoPlay: Boolean(raw.timerControls.autoPlay),
            autoReset: Boolean(raw.timerControls.autoReset),
            allowOverdue: Boolean(raw.timerControls.allowOverdue),
          }
        : undefined,
      pomodoro: isPomodoroConfig(raw.pomodoro) ? raw.pomodoro : undefined,
    });

    return [{
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateId(),
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled task',
      note: note || undefined,
      workspace: normalizeTaskWorkspace(raw.workspace),
      status: isTaskStatus(raw.status) ? raw.status : 'active',
      priority: isTaskPriority(raw.priority) ? raw.priority : 'normal',
      ...timing,
      reminders: Array.isArray(raw.reminders) ? raw.reminders.filter(isReminder) : [],
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso,
    }];
  });
}

export function mergeTaskUpdates(task: Task, updates: Partial<Task>, nowIso: string): Task {
  const merged = {
    ...task,
    ...updates,
    note: typeof updates.note === 'string'
      ? updates.note.trim().slice(0, TASK_NOTE_MAX_LENGTH) || undefined
      : task.note,
    workspace: normalizeTaskWorkspace(updates.workspace ?? task.workspace),
    updatedAt: nowIso,
  };

  return {
    ...merged,
    ...normalizeTaskTiming({
      timerMode: merged.timerMode,
      nowIso,
      targetAt: merged.targetAt,
      remainingSec: merged.remainingSec,
      originalDurationSec: merged.originalDurationSec,
      timerStatus: merged.timerStatus,
      timerControls: merged.timerControls,
      pomodoro: merged.pomodoro,
    }),
  };
}


