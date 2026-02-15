import { UrgencyLevel, Task } from '@/types';

/**
 * Calculate urgency level based on remaining time
 */
export function getUrgencyLevel(task: Task): UrgencyLevel {
  if (task.timerStatus === 'expired' || task.remainingSec < 0) {
    return 'overdue';
  }

  const minutes = task.remainingSec / 60;

  // Red: less than 5 minutes
  if (minutes < 5) {
    return 'red';
  }

  // Yellow: less than 15 minutes
  if (minutes < 15) {
    return 'yellow';
  }

  // Green: 15+ minutes remaining
  return 'green';
}

/**
 * Format seconds to human-readable time string
 */
export function formatTime(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const isNegative = seconds < 0;

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;

  let timeStr: string;

  if (hours > 0) {
    timeStr = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    timeStr = `${minutes}m`;
  } else {
    timeStr = `${secs}s`;
  }

  if (isNegative) {
    return `+${timeStr} overdue`;
  }

  return timeStr;
}

/**
 * Format time for badge display (shorter version)
 */
export function formatTimeBadge(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const isNegative = seconds < 0;

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);

  let timeStr: string;

  if (hours > 0) {
    timeStr = `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  } else if (minutes > 0) {
    timeStr = `${minutes}m`;
  } else {
    timeStr = `${absSeconds}s`;
  }

  if (isNegative) {
    return `+${timeStr}`;
  }

  return timeStr;
}

/**
 * Get urgency color class
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

/**
 * Check if task is approaching red (within specified window)
 */
export function isApproachingRed(task: Task, windowMinutes: number): boolean {
  const urgency = getUrgencyLevel(task);

  // Already red or overdue
  if (urgency === 'red' || urgency === 'overdue') {
    return false;
  }

  const windowSeconds = windowMinutes * 60;
  const redThreshold = 5 * 60; // 5 minutes threshold for red

  // Check if within the window
  return task.remainingSec <= redThreshold + windowSeconds && task.remainingSec > redThreshold;
}

