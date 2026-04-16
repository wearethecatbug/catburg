import type {
  CreateTaskInput,
  PomodoroConfig,
  Reminder,
  Task,
  TaskPriority,
  TaskStatus,
  TimerMode,
  TimerStatus,
  WorkspaceType,
} from './task.types';
import { TASK_NOTE_MAX_LENGTH } from './task.types';
import { generateId } from './helpers';

export function createTask(input: CreateTaskInput, nowIso: string): Task {
  const note = typeof input.note === 'string'
    ? input.note.trim().slice(0, TASK_NOTE_MAX_LENGTH)
    : '';
  const isDeadlineMode = input.timerMode === 'deadline';

  let durationSec: number;
  if (isDeadlineMode) {
    if (input.targetAt) {
      const targetTime = new Date(input.targetAt).getTime();
      const nowTime = new Date(nowIso).getTime();
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
    note: note || undefined,
    workspace: input.workspace ?? 'work',
    status: 'active',
    priority: input.priority ?? 'normal',
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
    task.id !== activeId && task.timerStatus === 'running'
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
  return value === 'duration' || value === 'pomodoro' || value === 'deadline';
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

    const remainingSec =
      typeof raw.remainingSec === 'number' && Number.isFinite(raw.remainingSec)
        ? raw.remainingSec
        : 25 * 60;
    const originalDurationSec =
      typeof raw.originalDurationSec === 'number' && Number.isFinite(raw.originalDurationSec)
        ? raw.originalDurationSec
        : remainingSec;
    const note = typeof raw.note === 'string'
      ? raw.note.trim().slice(0, TASK_NOTE_MAX_LENGTH)
      : '';

    return [{
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateId(),
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled task',
      note: note || undefined,
      workspace: typeof raw.workspace === 'string' ? (raw.workspace as WorkspaceType) : 'work',
      status: isTaskStatus(raw.status) ? raw.status : 'active',
      priority: isTaskPriority(raw.priority) ? raw.priority : 'normal',
      timerMode: isTimerMode(raw.timerMode) ? raw.timerMode : 'duration',
      targetAt: typeof raw.targetAt === 'string' ? raw.targetAt : undefined,
      remainingSec,
      originalDurationSec,
      timerStatus: isTimerStatus(raw.timerStatus) ? raw.timerStatus : 'idle',
      timerControls: isRecord(raw.timerControls)
        ? {
            autoStart: Boolean(raw.timerControls.autoStart),
            autoPlay: Boolean(raw.timerControls.autoPlay),
            autoReset: Boolean(raw.timerControls.autoReset),
            allowOverdue: Boolean(raw.timerControls.allowOverdue),
          }
        : undefined,
      pomodoro: isPomodoroConfig(raw.pomodoro) ? raw.pomodoro : undefined,
      reminders: Array.isArray(raw.reminders) ? raw.reminders.filter(isReminder) : [],
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso,
    }];
  });
}


