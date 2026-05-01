import { Task, TimerStatus } from './task.types';
import { supportsTimer } from './task.mode';

// ============================================================================
// Timer State Machine (pure, deterministic)
// ============================================================================

export type TimerEvent = 'toggle' | 'reset' | 'restart' | 'tick';

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
export function restartTimerState(task: Task, nowIso: string): Partial<Task> {
  if (!canRestartTimer(task)) {
    return {};
  }

  return resetTimerState(task, nowIso);
}

/**
 * Tick a running timer by 1 second.
 * Returns updated fields, or null if task is not running.
 */
export function tickTimer(task: Task): Partial<Task> | null {
  if (!supportsTimer(task.timerMode)) return null;
  if (task.timerStatus !== 'running') return null;

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
    return {
      remainingSec: task.originalDurationSec,
      timerStatus: 'running',  // keep running after reset
    };
  }

  // If allowOverdue is false and we've reached zero, expire the timer
  const isExpired = !allowOverdue && newRemaining === 0;

  return {
    remainingSec: newRemaining,
    timerStatus: isExpired ? 'expired' : 'running',
  };
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

  if (
      task.timerStatus === 'running' ||
      task.timerStatus === 'paused' ||
      task.timerStatus === 'expired'
  ) {
    return formatMmSs(task.remainingSec);
  }

  return formatMinutes(task.originalDurationSec);
}