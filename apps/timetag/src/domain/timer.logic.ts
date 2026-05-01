import type {
  PomodoroConfig,
  PomodoroPhase,
  PomodoroSessionState,
  Task,
  TimerAudioEvent,
  TimerDisplayMeta,
  TimerStatus,
} from './task.types';
import { supportsTimer } from './task.mode';
import { formatPomodoroCycleSummary } from './timer.presets';

// ============================================================================
// Timer State Machine (pure, deterministic)
// ============================================================================

export type TimerEvent = 'toggle' | 'reset' | 'restart' | 'tick';

export interface TimerTickResult {
  patch: Partial<Task>;
  audioEvents: TimerAudioEvent[];
}

type NextPomodoroPhase = PomodoroPhase | 'finished';

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function getSafePomodoroConfig(config: PomodoroConfig): PomodoroConfig {
  const workDurationSec = clampPositiveInt(config.workDurationSec, 25 * 60);
  const shortBreakDurationSec = clampPositiveInt(config.shortBreakDurationSec, 5 * 60);
  const longBreakDurationSec = clampPositiveInt(config.longBreakDurationSec, 15 * 60);

  return {
    ...config,
    cycles: clampPositiveInt(config.cycles, 1),
    workDurationSec,
    shortBreakDurationSec,
    longBreakDurationSec,
    workDurationMin: config.workDurationMin ?? Math.max(1, Math.ceil(workDurationSec / 60)),
    shortBreakMin: config.shortBreakMin ?? Math.max(1, Math.ceil(shortBreakDurationSec / 60)),
    longBreakMin: config.longBreakMin ?? Math.max(1, Math.ceil(longBreakDurationSec / 60)),
  };
}

function getSafePomodoroSession(session: PomodoroSessionState, config: PomodoroConfig): PomodoroSessionState {
  const safeConfig = getSafePomodoroConfig(config);
  const safeTotalCycles = safeConfig.cycles;
  const safeCycleIndex = Math.min(safeTotalCycles, clampPositiveInt(session.cycleIndex, 1));
  const safePhaseDurationSec = clampPositiveInt(
    session.currentPhaseDurationSec,
    getPomodoroPhaseDuration(session.phase, safeConfig),
  );

  return {
    phase: session.phase,
    cycleIndex: safeCycleIndex,
    totalCycles: safeTotalCycles,
    completedWorkCycles: Math.max(0, Math.min(safeTotalCycles, Math.floor(session.completedWorkCycles))),
    completedShortBreaks: Math.max(0, Math.min(Math.max(0, safeTotalCycles - 1), Math.floor(session.completedShortBreaks))),
    currentPhaseDurationSec: safePhaseDurationSec,
    remainingSec: Math.max(0, Math.floor(session.remainingSec)),
  };
}

function createTickResult(patch: Partial<Task>, audioEvents: TimerAudioEvent[] = []): TimerTickResult {
  return { patch, audioEvents };
}

export function getPomodoroPhaseDuration(phase: PomodoroPhase, config: PomodoroConfig): number {
  const safeConfig = getSafePomodoroConfig(config);

  switch (phase) {
    case 'shortBreak':
      return safeConfig.shortBreakDurationSec;
    case 'longBreak':
      return safeConfig.longBreakDurationSec;
    case 'work':
    default:
      return safeConfig.workDurationSec;
  }
}

export function createInitialPomodoroSession(config: PomodoroConfig): PomodoroSessionState {
  const safeConfig = getSafePomodoroConfig(config);
  const workDurationSec = getPomodoroPhaseDuration('work', safeConfig);

  return {
    phase: 'work',
    cycleIndex: 1,
    totalCycles: safeConfig.cycles,
    completedWorkCycles: 0,
    completedShortBreaks: 0,
    currentPhaseDurationSec: workDurationSec,
    remainingSec: workDurationSec,
  };
}

export function getNextPomodoroPhase(session: PomodoroSessionState, config: PomodoroConfig): NextPomodoroPhase {
  const safeSession = getSafePomodoroSession(session, config);
  const safeConfig = getSafePomodoroConfig(config);

  switch (safeSession.phase) {
    case 'work':
      return safeSession.completedWorkCycles + 1 >= safeConfig.cycles ? 'longBreak' : 'shortBreak';
    case 'shortBreak':
      return 'work';
    case 'longBreak':
      return 'finished';
    default:
      return 'finished';
  }
}

export function isPomodoroSessionFinished(session: PomodoroSessionState, config: PomodoroConfig): boolean {
  const safeSession = getSafePomodoroSession(session, config);
  const safeConfig = getSafePomodoroConfig(config);

  return (
    safeSession.phase === 'longBreak' &&
    safeSession.completedWorkCycles >= safeConfig.cycles &&
    safeSession.remainingSec <= 0
  );
}

export function getPomodoroDisplayMeta(session: PomodoroSessionState, config: PomodoroConfig): TimerDisplayMeta {
  const safeSession = getSafePomodoroSession(session, config);

  if (isPomodoroSessionFinished(safeSession, config)) {
    return {
      displayTime: formatMmSs(0),
      displayMeta: 'LB',
      phase: 'longBreak',
      tone: 'finished',
      isPomodoro: true,
    };
  }

  switch (safeSession.phase) {
    case 'shortBreak':
      return {
        displayTime: formatMmSs(safeSession.remainingSec),
        displayMeta: `B${safeSession.cycleIndex}`,
        phase: 'shortBreak',
        tone: 'break',
        isPomodoro: true,
      };
    case 'longBreak':
      return {
        displayTime: formatMmSs(safeSession.remainingSec),
        displayMeta: 'LB',
        phase: 'longBreak',
        tone: 'longBreak',
        isPomodoro: true,
      };
    case 'work':
    default:
      return {
        displayTime: formatMmSs(safeSession.remainingSec),
        displayMeta: `${safeSession.cycleIndex}/${safeSession.totalCycles}`,
        phase: 'work',
        tone: 'focus',
        isPomodoro: true,
      };
  }
}

function getPomodoroAutoStart(nextPhase: PomodoroPhase, config: PomodoroConfig): boolean {
  const safeConfig = getSafePomodoroConfig(config);
  return nextPhase === 'work'
    ? Boolean(safeConfig.autoStartNextWork)
    : Boolean(safeConfig.autoStartBreak);
}

function advancePomodoroSession(session: PomodoroSessionState, config: PomodoroConfig): {
  session: PomodoroSessionState;
  timerStatus: TimerStatus;
  audioEvents: TimerAudioEvent[];
} {
  const safeConfig = getSafePomodoroConfig(config);
  const safeSession = getSafePomodoroSession(session, safeConfig);
  const nextPhase = getNextPomodoroPhase(safeSession, safeConfig);

  if (nextPhase === 'finished') {
    return {
      session: {
        ...safeSession,
        phase: 'longBreak',
        cycleIndex: safeConfig.cycles,
        totalCycles: safeConfig.cycles,
        completedWorkCycles: safeConfig.cycles,
        completedShortBreaks: Math.max(0, safeConfig.cycles - 1),
        currentPhaseDurationSec: getPomodoroPhaseDuration('longBreak', safeConfig),
        remainingSec: 0,
      },
      timerStatus: 'expired',
      audioEvents: ['longBreakFinished', 'pomodoroSessionFinished'],
    };
  }

  if (safeSession.phase === 'work') {
    const completedWorkCycles = Math.min(safeConfig.cycles, safeSession.completedWorkCycles + 1);
    const nextSession: PomodoroSessionState = {
      phase: nextPhase,
      cycleIndex: completedWorkCycles,
      totalCycles: safeConfig.cycles,
      completedWorkCycles,
      completedShortBreaks: safeSession.completedShortBreaks,
      currentPhaseDurationSec: getPomodoroPhaseDuration(nextPhase, safeConfig),
      remainingSec: getPomodoroPhaseDuration(nextPhase, safeConfig),
    };

    return {
      session: nextSession,
      timerStatus: getPomodoroAutoStart(nextPhase, safeConfig) ? 'running' : 'paused',
      audioEvents: nextPhase === 'longBreak'
        ? ['workFinished', 'longBreakStarted']
        : ['workFinished', 'shortBreakStarted'],
    };
  }

  const nextCycleIndex = Math.min(safeConfig.cycles, safeSession.cycleIndex + 1);
  const completedShortBreaks = Math.min(Math.max(0, safeConfig.cycles - 1), safeSession.completedShortBreaks + 1);
  const nextSession: PomodoroSessionState = {
    phase: 'work',
    cycleIndex: nextCycleIndex,
    totalCycles: safeConfig.cycles,
    completedWorkCycles: safeSession.completedWorkCycles,
    completedShortBreaks,
    currentPhaseDurationSec: getPomodoroPhaseDuration('work', safeConfig),
    remainingSec: getPomodoroPhaseDuration('work', safeConfig),
  };

  return {
    session: nextSession,
    timerStatus: getPomodoroAutoStart('work', safeConfig) ? 'running' : 'paused',
    audioEvents: ['shortBreakFinished'],
  };
}

/**
 * Compute next timer state after toggle.
 * running → paused, paused/idle → running, expired → expired (no-op)
 */
export function toggleTimerState(task: Task, nowIso: string): Partial<Task> {
  if (!supportsTimer(task.timerMode)) return {};

  let newStatus: TimerStatus;

  if (task.timerStatus === 'running') newStatus = 'paused';
  else if (task.timerStatus === 'expired') newStatus = 'expired';
  else newStatus = 'running';

  // если expired = no-op, можно не обновлять updatedAt:
  if (task.timerStatus === 'expired') return {};

  return {
    timerStatus: newStatus,
    updatedAt: nowIso,
  };
}

/**
 * Reset timer to original duration.
 */
export function resetTimerState(task: Task, nowIso: string): Partial<Task> {
  if (!supportsTimer(task.timerMode)) return {};

  if (task.timerMode === 'pomodoro' && task.pomodoro) {
    const pomodoroSession = createInitialPomodoroSession(task.pomodoro);

    return {
      remainingSec: pomodoroSession.remainingSec,
      originalDurationSec: pomodoroSession.currentPhaseDurationSec,
      timerStatus: 'idle',
      pomodoroSession,
      updatedAt: nowIso,
    };
  }

  return {
    remainingSec: task.originalDurationSec,
    timerStatus: 'idle',
    updatedAt: nowIso,
  };
}

/**
 * Row-level timer restart is only available for active timed tasks.
 * Done/archived rows keep their existing restrictions and cannot gain
 * restart behavior implicitly through the timer control.
 */
export function canRestartTimer(task: Task): boolean {
  return supportsTimer(task.timerMode) && task.status === 'active';
}

/**
 * Restart semantics for the row timer control:
 * - restore the initial configured duration
 * - always return to idle (do not auto-resume)
 * - keep unsupported and restricted tasks as no-ops
 */
export function restartTimerState(
  task: Task,
  nowIso: string,
  options: { autoStart?: boolean } = {},
): Partial<Task> {
  if (!canRestartTimer(task)) {
    return {};
  }

  const baseReset = resetTimerState(task, nowIso);
  return options.autoStart
    ? {
        ...baseReset,
        timerStatus: 'running',
      }
    : baseReset;
}

/**
 * Tick a running timer by 1 second.
 * Returns updated fields, or null if task is not running.
 */
export function tickTimer(task: Task): TimerTickResult | null {
  if (!supportsTimer(task.timerMode)) return null;
  if (task.timerStatus !== 'running') return null;

  if (task.timerMode === 'pomodoro' && task.pomodoro && task.pomodoroSession) {
    const safeConfig = getSafePomodoroConfig(task.pomodoro);
    const safeSession = getSafePomodoroSession(task.pomodoroSession, safeConfig);

    if (safeSession.remainingSec > 1) {
      const remainingSec = safeSession.remainingSec - 1;
      return createTickResult({
        remainingSec,
        originalDurationSec: safeSession.currentPhaseDurationSec,
        timerStatus: 'running',
        pomodoroSession: {
          ...safeSession,
          remainingSec,
        },
      });
    }

    const transition = advancePomodoroSession(safeSession, safeConfig);
    return createTickResult({
      remainingSec: transition.session.remainingSec,
      originalDurationSec: transition.session.currentPhaseDurationSec,
      timerStatus: transition.timerStatus,
      pomodoroSession: transition.session,
    }, transition.audioEvents);
  }

  const allowOverdue = task.timerControls?.allowOverdue ?? false;
  const autoReset = task.timerControls?.autoReset ?? false;

  // Decrement timer by 1 second
  const newRemaining = allowOverdue 
    ? task.remainingSec - 1  // can go negative
    : Math.max(0, task.remainingSec - 1);  // stops at 0

  // Check if timer has reached zero (or gone past it)
  const hasReachedZero = task.remainingSec > 0 && newRemaining <= 0;

  // If autoReset is enabled and we just reached zero, reset the timer
  if (autoReset && hasReachedZero) {
    return createTickResult({
      remainingSec: task.originalDurationSec,
      timerStatus: 'running',  // keep running after reset
    });
  }

  // If allowOverdue is false and we've reached zero, expire the timer
  const isExpired = !allowOverdue && newRemaining === 0;

  return createTickResult({
    remainingSec: newRemaining,
    timerStatus: isExpired ? 'expired' : 'running',
  });
}

export function formatMmSs(totalSec: number): string {
  const isNegative = totalSec < 0;
  const sec = Math.abs(Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Для “длительности” обычно лучше ceil, чтобы 61s не превращались в "1m" или "0m" неожиданно.
 * Если originalDurationSec у тебя всегда кратно 60 — можно оставить round.
 */
export function formatMinutes(totalSec: number): string {
  const m = Math.max(1, Math.ceil(Math.max(0, totalSec) / 60));
  return `${m}m`;
}

/**
 * Label for the “chip” in the list (like on the left screenshot):
 * - running/paused/expired: show remaining as MM:SS
 * - idle: show original duration as Xm
 */
export function getRowTimerLabel(task: Task): string {
  if (!supportsTimer(task.timerMode)) {
    return 'Note';
  }

  if (task.timerMode === 'pomodoro' && task.pomodoro) {
    if (task.timerStatus === 'idle') {
      return formatPomodoroCycleSummary(task.pomodoro);
    }

    if (task.pomodoroSession) {
      return getPomodoroDisplayMeta(task.pomodoroSession, task.pomodoro).displayTime;
    }
  }

  if (
      task.timerStatus === 'running' ||
      task.timerStatus === 'paused' ||
      task.timerStatus === 'expired'
  ) {
    return formatMmSs(task.remainingSec);
  }

  return formatMinutes(task.originalDurationSec);
}