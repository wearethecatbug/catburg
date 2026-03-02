/**
 * Format remaining seconds to human-readable format (max 5 characters for UI alignment)
 * @param remainingSec - remaining seconds (can be negative for overdue)
 * @returns Short format (e.g., "1d", "5h", "30m", "-5h", "1×25m")
 * Max length: 5 characters (e.g., "-999h", "999d")
 */
export function formatTimeShort(remainingSec: number): string {
  // Handle zero
  if (remainingSec === 0) return '0s';
  
  // Handle negative (overdue) - show with minus sign
  const isNegative = remainingSec < 0;
  const absSeconds = Math.abs(remainingSec);
  
  const minutes = Math.floor(absSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let result = '';
  
  // Priority: days > hours > minutes > seconds
  // For hours: DON'T show remaining minutes to keep it short (max 5 chars)
  if (days > 0) {
    result = `${days}d`;
  } else if (hours > 0) {
    result = `${hours}h`;  // Just hours, no minutes (e.g., "5h" instead of "5h 30m")
  } else if (minutes > 0) {
    result = `${minutes}m`;
  } else {
    result = `${Math.floor(absSeconds)}s`;
  }
  
  return isNegative ? `-${result}` : result;
}

/**
 * Format remaining seconds to full format with tooltip
 * @param remainingSec - remaining seconds (can be negative for overdue)
 * @returns Full format (e.g., "1d 5h 30m 45s" or "-2h 15m 30s" for overdue)
 */
export function formatTimeFull(remainingSec: number): string {
  // Handle zero
  if (remainingSec === 0) return '0s';
  
  // Handle negative (overdue) - show with minus sign
  const isNegative = remainingSec < 0;
  let seconds = Math.abs(remainingSec);
  
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  const result = parts.length > 0 ? parts.join(' ') : '0s';
  return isNegative ? `-${result}` : result;
}

/**
 * Get display format based on remaining time
 * - If > 24 hours: show days (e.g., "1d")
 * - Otherwise: show hours/minutes/seconds
 * @param remainingSec - remaining seconds
 * @returns { short: string, full: string }
 */
export function getTimeDisplay(remainingSec: number) {
  return {
    short: formatTimeShort(remainingSec),
    full: formatTimeFull(remainingSec),
  };
}

