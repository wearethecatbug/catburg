import type { TimerMode } from './task.types';

export function isTimedMode(mode: TimerMode): boolean {
  return mode !== 'note';
}

export function supportsTimer(mode: TimerMode): boolean {
  return isTimedMode(mode);
}

export function supportsUrgency(mode: TimerMode): boolean {
  return isTimedMode(mode);
}

