import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
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
 * Format time for badge display (max 5 characters for UI alignment)
 * Examples: "5h", "30m", "-5h", "123s"
 */
export function formatTimeBadge(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const isNegative = seconds < 0;

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);

  let timeStr: string;

  if (hours > 0) {
    timeStr = `${hours}h`;  // Just hours, no minutes (e.g., "5h" instead of "5h 30m")
  } else if (minutes > 0) {
    timeStr = `${minutes}m`;
  } else {
    timeStr = `${absSeconds}s`;
  }

  return isNegative ? `-${timeStr}` : timeStr;
}

