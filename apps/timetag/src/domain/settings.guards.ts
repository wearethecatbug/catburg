import type { ContentWidthMode, OvertimeBehavior } from './settings.types';
import type { TimerMode } from './task.types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}


export function isOvertimeBehavior(value: unknown): value is OvertimeBehavior {
  return value === 'continue' || value === 'stop';
}

export function isContentWidthMode(value: unknown): value is ContentWidthMode {
  return value === 'compact' || value === 'comfortable' || value === 'wide';
}

export function isTimerMode(value: unknown): value is TimerMode {
  return value === 'duration' || value === 'pomodoro' || value === 'deadline' || value === 'note';
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

