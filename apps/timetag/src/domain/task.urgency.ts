import { Task, UrgencyLevel } from './task.types';

// ============================================================================
// Urgency Calculation (pure, deterministic)
// Urgency is based on PERCENTAGE of remaining time, not absolute minutes
// This allows fair assessment across tasks with different durations
// ============================================================================

/**
 * Calculate urgency level based on remaining time as percentage of original duration
 * - normal: 50%+ of original duration remains
 * - warn: 20-50% of original duration remains
 * - danger: <20% of original duration remains
 * - overdue: time expired (remainingSec < 0)
 */
export function getUrgencyLevel(task: Task): UrgencyLevel {
  if (task.timerStatus === 'expired' || task.remainingSec < 0) {
    return 'overdue';
  }

  // Avoid division by zero
  if (task.originalDurationSec === 0) {
    return 'danger';
  }

  const percentageRemaining = (task.remainingSec / task.originalDurationSec) * 100;

  if (percentageRemaining >= 50) return 'normal';
  if (percentageRemaining >= 20) return 'warn';
  return 'danger';
}

/**
 * Check if task is approaching danger threshold (within specified window)
 * Calculates how many minutes remain before task enters "danger" zone (20% threshold)
 * Returns true if:
 * - Task is in 'warn' zone (20-50%)
 * - AND within the user-specified window (5/10/30 min) of reaching 'danger' zone
 */
export function isApproachingRed(task: Task, windowMinutes: number): boolean {
  const urgency = getUrgencyLevel(task);

  // Already danger or overdue — not "approaching"
  if (urgency === 'danger' || urgency === 'overdue') {
    return false;
  }

  // Only warn zone can be "approaching red"
  if (urgency !== 'warn') {
    return false;
  }

  // Avoid division by zero
  if (task.originalDurationSec === 0) {
    return false;
  }

  // Calculate when task will reach danger zone (20% remaining)
  const dangerThresholdSec = task.originalDurationSec * 0.2;
  const windowSeconds = windowMinutes * 60;

  // "Approaching" means: will reach danger zone within the window
  return task.remainingSec <= dangerThresholdSec + windowSeconds;
}

/**
 * Get urgency color Tailwind class
 */
export function getUrgencyColorClass(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'normal':
      return 'bg-green-500 text-white';
    case 'warn':
      return 'bg-yellow-500 text-black';
    case 'danger':
      return 'bg-red-500 text-white';
    case 'overdue':
      return 'bg-red-700 text-white animate-pulse';
  }
}

