import type {
  AssignableWorkspaceType,
  CreateTaskInput,
  PomodoroConfig,
  PomodoroPhase,
  PomodoroSessionState,
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
import { normalizeTimerBehaviorOverride } from './timer.behavior';
import { createInitialPomodoroSession, getPomodoroPhaseDuration } from './timer.logic';
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

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function isPomodoroPhase(value: unknown): value is PomodoroPhase {
  return value === 'work' || value === 'shortBreak' || value === 'longBreak';
}

function getPomodoroDurationSec(raw: Record<string, unknown>, keySec: string, keyMin: string, fallbackSec: number): number {
  if (isFiniteNumber(raw[keySec]) && raw[keySec] > 0) {
    return Math.max(1, Math.floor(raw[keySec]));
  }

  if (isFiniteNumber(raw[keyMin]) && raw[keyMin] > 0) {
    return Math.max(1, Math.floor(raw[keyMin])) * 60;
  }

  return fallbackSec;
}

function getPomodoroDurationMin(raw: Record<string, unknown>, keyMin: string, durationSec: number): number {
  if (isFiniteNumber(raw[keyMin]) && raw[keyMin] > 0) {
    return Math.max(1, Math.floor(raw[keyMin]));
  }

  return Math.max(1, Math.ceil(durationSec / 60));
}

function normalizePomodoroConfig(raw: unknown): PomodoroConfig | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const cycles = toPositiveInt(raw.cycles, 1);
  const workDurationSec = getPomodoroDurationSec(raw, 'workDurationSec', 'workDurationMin', 25 * 60);
  const shortBreakDurationSec = getPomodoroDurationSec(raw, 'shortBreakDurationSec', 'shortBreakMin', 5 * 60);
  const longBreakDurationSec = getPomodoroDurationSec(raw, 'longBreakDurationSec', 'longBreakMin', 15 * 60);

  return {
    cycles,
    workDurationSec,
    shortBreakDurationSec,
    longBreakDurationSec,
    autoStartBreak:
      typeof raw.autoStartBreak === 'boolean'
        ? raw.autoStartBreak
        : typeof raw.autoStart === 'boolean'
          ? raw.autoStart
          : undefined,
    autoStartNextWork:
      typeof raw.autoStartNextWork === 'boolean'
        ? raw.autoStartNextWork
        : typeof raw.autoPlay === 'boolean'
          ? raw.autoPlay
          : undefined,
    workDurationMin: getPomodoroDurationMin(raw, 'workDurationMin', workDurationSec),
    shortBreakMin: getPomodoroDurationMin(raw, 'shortBreakMin', shortBreakDurationSec),
    longBreakMin: getPomodoroDurationMin(raw, 'longBreakMin', longBreakDurationSec),
  };
}

function deriveLegacyPomodoroSession(rawPomodoro: unknown, config: PomodoroConfig, fallbackRemainingSec?: number, fallbackDurationSec?: number): PomodoroSessionState {
  const safeCycles = Math.max(1, config.cycles);

  if (!isRecord(rawPomodoro)) {
    const initialSession = createInitialPomodoroSession(config);

    return {
      ...initialSession,
      currentPhaseDurationSec: isFiniteNumber(fallbackDurationSec) && fallbackDurationSec > 0
        ? Math.floor(fallbackDurationSec)
        : initialSession.currentPhaseDurationSec,
      remainingSec: isFiniteNumber(fallbackRemainingSec)
        ? Math.max(0, Math.floor(fallbackRemainingSec))
        : initialSession.remainingSec,
    };
  }

  const legacyCycleIndex = Math.min(safeCycles, toPositiveInt(rawPomodoro.currentCycle, 1));
  const legacyPhase: PomodoroPhase = rawPomodoro.isBreak === true
    ? (legacyCycleIndex >= safeCycles ? 'longBreak' : 'shortBreak')
    : 'work';
  const currentPhaseDurationSec = isFiniteNumber(fallbackDurationSec) && fallbackDurationSec > 0
    ? Math.floor(fallbackDurationSec)
    : getPomodoroPhaseDuration(legacyPhase, config);

  return {
    phase: legacyPhase,
    cycleIndex: legacyCycleIndex,
    totalCycles: safeCycles,
    completedWorkCycles: legacyPhase === 'work' ? Math.max(0, legacyCycleIndex - 1) : legacyCycleIndex,
    completedShortBreaks:
      legacyPhase === 'work'
        ? Math.max(0, legacyCycleIndex - 1)
        : legacyPhase === 'shortBreak'
          ? Math.max(0, legacyCycleIndex - 1)
          : Math.max(0, safeCycles - 1),
    currentPhaseDurationSec,
    remainingSec: isFiniteNumber(fallbackRemainingSec)
      ? Math.max(0, Math.floor(fallbackRemainingSec))
      : currentPhaseDurationSec,
  };
}

function normalizePomodoroSession(
  rawSession: unknown,
  config: PomodoroConfig,
  fallbackRemainingSec?: number,
  fallbackDurationSec?: number,
  rawPomodoro?: unknown,
): PomodoroSessionState {
  if (!isRecord(rawSession)) {
    return deriveLegacyPomodoroSession(rawPomodoro, config, fallbackRemainingSec, fallbackDurationSec);
  }

  const phase = isPomodoroPhase(rawSession.phase) ? rawSession.phase : 'work';
  const cycleIndex = Math.min(config.cycles, toPositiveInt(rawSession.cycleIndex, 1));
  const totalCycles = Math.max(1, config.cycles);
  const currentPhaseDurationSec = toPositiveInt(
    rawSession.currentPhaseDurationSec,
    isFiniteNumber(fallbackDurationSec) && fallbackDurationSec > 0
      ? Math.floor(fallbackDurationSec)
      : getPomodoroPhaseDuration(phase, config),
  );

  return {
    phase,
    cycleIndex,
    totalCycles,
    completedWorkCycles: Math.min(totalCycles, toNonNegativeInt(rawSession.completedWorkCycles, phase === 'work' ? cycleIndex - 1 : cycleIndex)),
    completedShortBreaks: Math.min(
      Math.max(0, totalCycles - 1),
      toNonNegativeInt(
        rawSession.completedShortBreaks,
        phase === 'work' ? Math.max(0, cycleIndex - 1) : phase === 'shortBreak' ? Math.max(0, cycleIndex - 1) : Math.max(0, totalCycles - 1),
      ),
    ),
    currentPhaseDurationSec,
    remainingSec: isFiniteNumber(rawSession.remainingSec)
      ? Math.max(0, Math.floor(rawSession.remainingSec))
      : isFiniteNumber(fallbackRemainingSec)
        ? Math.max(0, Math.floor(fallbackRemainingSec))
        : currentPhaseDurationSec,
  };
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
    pomodoro?: unknown;
    pomodoroSession?: unknown;
  },
): Pick<Task, 'timerMode' | 'targetAt' | 'remainingSec' | 'originalDurationSec' | 'timerStatus' | 'timerControls' | 'pomodoro' | 'pomodoroSession'> {
  if (!supportsTimer(input.timerMode)) {
    return {
      timerMode: input.timerMode,
      targetAt: undefined,
      remainingSec: 0,
      originalDurationSec: 0,
      timerStatus: 'idle',
      timerControls: undefined,
      pomodoro: undefined,
      pomodoroSession: undefined,
    };
  }

  const timerControls = normalizeTimerControls(input.timerControls);
  const timerStatus = isTimerStatus(input.timerStatus)
    ? input.timerStatus
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
      pomodoroSession: undefined,
    };
  }

  if (input.timerMode === 'pomodoro') {
    const pomodoro = normalizePomodoroConfig(input.pomodoro) ?? {
      cycles: 1,
      workDurationSec: 25 * 60,
      shortBreakDurationSec: 5 * 60,
      longBreakDurationSec: 15 * 60,
      workDurationMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
    };
    const pomodoroSession = normalizePomodoroSession(
      input.pomodoroSession,
      pomodoro,
      input.remainingSec,
      input.originalDurationSec,
      input.pomodoro,
    );

    return {
      timerMode: input.timerMode,
      targetAt: undefined,
      remainingSec: pomodoroSession.remainingSec,
      originalDurationSec: pomodoroSession.currentPhaseDurationSec,
      timerStatus,
      timerControls,
      pomodoro,
      pomodoroSession,
    };
  }

  const fallbackDurationSec = isFiniteNumber(input.durationSec) && input.durationSec > 0
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
    pomodoro: undefined,
    pomodoroSession: undefined,
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
    timerStatus: input.timerControls?.autoStart ? 'running' : 'idle',
    timerControls: input.timerControls,
    pomodoro: input.pomodoro,
    pomodoroSession: input.pomodoroSession,
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
    timerBehaviorOverride: supportsTimer(timerMode)
      ? normalizeTimerBehaviorOverride(input.timerBehaviorOverride)
      : undefined,
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
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
      pomodoro: raw.pomodoro,
      pomodoroSession: raw.pomodoroSession,
    });

    return [{
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateId(),
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled task',
      note: note || undefined,
      workspace: normalizeTaskWorkspace(raw.workspace),
      status: isTaskStatus(raw.status) ? raw.status : 'active',
      priority: isTaskPriority(raw.priority) ? raw.priority : 'normal',
      ...timing,
      timerBehaviorOverride: supportsTimer(timerMode)
        ? normalizeTimerBehaviorOverride(raw.timerBehaviorOverride)
        : undefined,
      reminders: Array.isArray(raw.reminders) ? raw.reminders.filter(isReminder) : [],
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso,
    }];
  });
}

export function mergeTaskUpdates(task: Task, updates: Partial<Task>, nowIso: string): Task {
  const hasNoteUpdate = Object.prototype.hasOwnProperty.call(updates, 'note');
  const nextTimerMode = isTimerMode(updates.timerMode) ? updates.timerMode : task.timerMode;
  const shouldResetPomodoroSession = nextTimerMode === 'pomodoro' && (
    task.timerMode !== 'pomodoro' ||
    Object.prototype.hasOwnProperty.call(updates, 'pomodoro')
  );

  const merged = {
    ...task,
    ...updates,
    timerMode: nextTimerMode,
    note: hasNoteUpdate
      ? (typeof updates.note === 'string'
          ? updates.note.trim().slice(0, TASK_NOTE_MAX_LENGTH) || undefined
          : updates.note)
      : task.note,
    workspace: normalizeTaskWorkspace(updates.workspace ?? task.workspace),
    updatedAt: nowIso,
  };

  return {
    ...merged,
    timerBehaviorOverride: supportsTimer(merged.timerMode)
      ? normalizeTimerBehaviorOverride(merged.timerBehaviorOverride)
      : undefined,
    ...normalizeTaskTiming({
      timerMode: merged.timerMode,
      nowIso,
      targetAt: merged.targetAt,
      remainingSec: merged.remainingSec,
      originalDurationSec: merged.originalDurationSec,
      timerStatus: merged.timerStatus,
      timerControls: merged.timerControls,
      pomodoro: merged.pomodoro,
      pomodoroSession: shouldResetPomodoroSession ? undefined : merged.pomodoroSession,
    }),
  };
}


