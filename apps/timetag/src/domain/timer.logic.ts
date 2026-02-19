import { Task, TimerStatus } from './task.types';

// ============================================================================
// Timer State Machine (pure, deterministic)
// ============================================================================

/**
 * Timer events
 */
export type TimerEvent = 'toggle' | 'reset' | 'tick';

/**
 * Compute next timer state after toggle.
 * running → paused, paused/idle → running, expired → expired (no-op)
 */
export function toggleTimerState(task: Task): Partial<Task> {
  let newStatus: TimerStatus;

  if (task.timerStatus === 'running') {
    newStatus = 'paused';
  } else if (task.timerStatus === 'expired') {
    newStatus = 'expired'; // no-op
  } else {
    newStatus = 'running';
  }

  return {
    timerStatus: newStatus,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reset timer to original duration.
 */
export function resetTimerState(task: Task): Partial<Task> {
  return {
    remainingSec: task.originalDurationSec,
    timerStatus: 'idle',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Tick a running timer by 1 second.
 * Returns updated fields, or null if task is not running.
 */
export function tickTimer(task: Task): Partial<Task> | null {
  if (task.timerStatus !== 'running') return null;

  const newRemaining = task.remainingSec - 1;
  const isExpired = newRemaining <= 0;

  return {
    remainingSec: newRemaining,
    timerStatus: isExpired ? 'expired' : 'running',
  };
}

