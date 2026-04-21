import { Task, UrgencyLevel } from './task.types';
import { supportsUrgency } from './task.mode';

export const URGENCY_NORMAL_MIN_RATIO = 0.5;
export const URGENCY_WARN_MIN_RATIO = 0.2;

const URGENCY_LEVEL_ORDER: ReadonlyArray<UrgencyLevel> = ['normal', 'warn', 'danger', 'overdue'];

export const URGENCY_FILTER_LABELS: Record<UrgencyLevel, string> = {
  normal: `Green (${Math.round(URGENCY_NORMAL_MIN_RATIO * 100)}%+)`,
  warn: `Yellow (${Math.round(URGENCY_WARN_MIN_RATIO * 100)}-${Math.round(URGENCY_NORMAL_MIN_RATIO * 100)}%)`,
  danger: `Red (< ${Math.round(URGENCY_WARN_MIN_RATIO * 100)}%)`,
  overdue: 'Overdue',
};

export const URGENCY_FILTER_OPTIONS: ReadonlyArray<{ id: UrgencyLevel; label: string }> = URGENCY_LEVEL_ORDER.map((id) => ({
  id,
  label: URGENCY_FILTER_LABELS[id],
}));

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
  if (!supportsUrgency(task.timerMode)) {
    return 'normal';
  }

  if (task.timerStatus === 'expired' || task.remainingSec < 0) {
    return 'overdue';
  }

  // Avoid division by zero
  if (task.originalDurationSec === 0) {
    return 'danger';
  }

  const remainingRatio = task.remainingSec / task.originalDurationSec;

  if (remainingRatio >= URGENCY_NORMAL_MIN_RATIO) return 'normal';
  if (remainingRatio >= URGENCY_WARN_MIN_RATIO) return 'warn';
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
  if (!supportsUrgency(task.timerMode)) {
    return false;
  }

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
  const dangerThresholdSec = task.originalDurationSec * URGENCY_WARN_MIN_RATIO;
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

