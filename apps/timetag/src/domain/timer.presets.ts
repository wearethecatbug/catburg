import { formatDurationValue, type DurationUnit } from './duration';

export type PomodoroPresetId = 'classic' | 'focus' | 'extended' | 'quick';
export type DeadlinePresetId = '1d' | '2d' | '5d' | '10d';

export interface PomodoroPresetOption {
  id: PomodoroPresetId;
  label: string;
  cycles: number;
  workDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
}

export interface DeadlinePresetOption {
  id: DeadlinePresetId;
  label: string;
  offsetSec: number;
}

export const MIN_DEADLINE_OFFSET_SEC = 60;
export const MAX_DEADLINE_OFFSET_SEC = 365 * 86400;

export const POMODORO_PRESETS: PomodoroPresetOption[] = [
  {
    id: 'classic',
    label: 'Classic (1×25m)',
    cycles: 1,
    workDurationMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
  },
  {
    id: 'focus',
    label: 'Focus (2×25m)',
    cycles: 2,
    workDurationMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
  },
  {
    id: 'extended',
    label: 'Extended (4×25m)',
    cycles: 4,
    workDurationMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
  },
  {
    id: 'quick',
    label: 'Quick (3×15m)',
    cycles: 3,
    workDurationMin: 15,
    shortBreakMin: 3,
    longBreakMin: 10,
  },
];

export const DEADLINE_PRESETS: DeadlinePresetOption[] = [
  { id: '1d', label: '1 day', offsetSec: 86400 },
  { id: '2d', label: '2 days', offsetSec: 2 * 86400 },
  { id: '5d', label: '5 days', offsetSec: 5 * 86400 },
  { id: '10d', label: '10 days', offsetSec: 10 * 86400 },
];

export function isPomodoroPresetId(value: unknown): value is PomodoroPresetId {
  return POMODORO_PRESETS.some((preset) => preset.id === value);
}

export function isDeadlinePresetId(value: unknown): value is DeadlinePresetId {
  return DEADLINE_PRESETS.some((preset) => preset.id === value);
}

export function filterPomodoroPresetIds(values: unknown): PomodoroPresetId[] {
  if (!Array.isArray(values)) return [];
  return values.filter(isPomodoroPresetId);
}

export function filterDeadlinePresetIds(values: unknown): DeadlinePresetId[] {
  if (!Array.isArray(values)) return [];
  return values.filter(isDeadlinePresetId);
}

export function getPomodoroPresetById(id: unknown): PomodoroPresetOption {
  return POMODORO_PRESETS.find((preset) => preset.id === id) ?? POMODORO_PRESETS[0];
}

export function getVisiblePomodoroPresets(hiddenIds: readonly PomodoroPresetId[] = []): PomodoroPresetOption[] {
  const visiblePresets = POMODORO_PRESETS.filter((preset) => !hiddenIds.includes(preset.id));
  return visiblePresets.length > 0 ? visiblePresets : [getPomodoroPresetById(undefined)];
}

export function getVisiblePomodoroPresetById(
  id: unknown,
  hiddenIds: readonly PomodoroPresetId[] = [],
): PomodoroPresetOption {
  return getVisiblePomodoroPresets(hiddenIds).find((preset) => preset.id === id) ?? getVisiblePomodoroPresets(hiddenIds)[0];
}

export function getDeadlinePresetById(id: unknown): DeadlinePresetOption {
  return DEADLINE_PRESETS.find((preset) => preset.id === id) ?? DEADLINE_PRESETS[0];
}

export function getVisibleDeadlinePresets(hiddenIds: readonly DeadlinePresetId[] = []): DeadlinePresetOption[] {
  const visiblePresets = DEADLINE_PRESETS.filter((preset) => !hiddenIds.includes(preset.id));
  return visiblePresets.length > 0 ? visiblePresets : [getDeadlinePresetById(undefined)];
}

export function getVisibleDeadlinePresetById(
  id: unknown,
  hiddenIds: readonly DeadlinePresetId[] = [],
): DeadlinePresetOption {
  return getVisibleDeadlinePresets(hiddenIds).find((preset) => preset.id === id) ?? getVisibleDeadlinePresets(hiddenIds)[0];
}

export function clampDeadlineOffsetSec(value: number): number {
  const safeValue = Number.isFinite(value) ? value : MIN_DEADLINE_OFFSET_SEC;
  return Math.min(MAX_DEADLINE_OFFSET_SEC, Math.max(MIN_DEADLINE_OFFSET_SEC, Math.round(safeValue)));
}

export function getDeadlineUnitFromSec(valueSec: number): DurationUnit {
  if (valueSec % 86400 === 0) return 'd';
  if (valueSec % 3600 === 0) return 'h';
  return 'min';
}

export function formatDeadlineOffsetLabel(offsetSec: number): string {
  const unit = getDeadlineUnitFromSec(offsetSec);
  const unitLabel = unit === 'min' ? 'm' : unit;
  return `${formatDurationValue(offsetSec, unit)}${unitLabel}`;
}

export function formatPomodoroPresetLabel(config: Pick<PomodoroPresetOption, 'cycles' | 'workDurationMin' | 'shortBreakMin' | 'longBreakMin'>): string {
  return `${config.cycles}×${config.workDurationMin}m · S${config.shortBreakMin}m · L${config.longBreakMin}m`;
}

export function formatNamedPomodoroPresetLabel(preset: PomodoroPresetOption): string {
  return `${preset.label} · S${preset.shortBreakMin}m · L${preset.longBreakMin}m`;
}

