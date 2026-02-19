import { Task, UrgencyLevel } from './task.types';

// ============================================================================
// Urgency Calculation (pure, deterministic)
// ============================================================================

/**
 * Calculate urgency level based on remaining time
 */
export function getUrgencyLevel(task: Task): UrgencyLevel {
  if (task.timerStatus === 'expired' || task.remainingSec < 0) {
    return 'overdue';
  }

  const minutes = task.remainingSec / 60;

  if (minutes < 5) return 'red';
  if (minutes < 15) return 'yellow';
  return 'green';
}

/**
 * Check if task is approaching red (within specified window)
 */
export function isApproachingRed(task: Task, windowMinutes: number): boolean {
  const urgency = getUrgencyLevel(task);

  // Already red or overdue — not "approaching"
  if (urgency === 'red' || urgency === 'overdue') {
    return false;
  }

  const windowSeconds = windowMinutes * 60;
  const redThreshold = 5 * 60; // 5 minutes threshold for red

  return (
    task.remainingSec <= redThreshold + windowSeconds &&
    task.remainingSec > redThreshold
  );
}

/**
 * Get urgency color Tailwind class
 */
export function getUrgencyColorClass(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'green':
      return 'bg-green-500 text-white';
    case 'yellow':
      return 'bg-yellow-500 text-black';
    case 'red':
      return 'bg-red-500 text-white';
    case 'overdue':
      return 'bg-red-700 text-white animate-pulse';
  }
}

