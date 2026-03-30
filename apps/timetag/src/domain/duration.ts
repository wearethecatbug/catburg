export type DurationUnit = 'min' | 'h' | 'd';

export type DurationPresetId = '5' | '10' | '25' | '45' | '60';

export interface DurationPresetOption {
    id: DurationPresetId;
    label: string;
    durationSec: number;
}

export const DURATION_PRESETS: DurationPresetOption[] = [
    { id: '5', label: '5m', durationSec: 5 * 60 },
    { id: '10', label: '10m', durationSec: 10 * 60 },
    { id: '25', label: '25m', durationSec: 25 * 60 },
    { id: '45', label: '45m', durationSec: 45 * 60 },
    { id: '60', label: '1h', durationSec: 60 * 60 },
];

export const MIN_DURATION_SEC = 60;

export function isDurationPresetId(value: unknown): value is DurationPresetId {
    return DURATION_PRESETS.some((preset) => preset.id === value);
}

export function filterDurationPresetIds(values: unknown): DurationPresetId[] {
    if (!Array.isArray(values)) return [];
    return values.filter(isDurationPresetId);
}

export function getDurationPresetById(id: unknown): DurationPresetOption {
    return DURATION_PRESETS.find((preset) => preset.id === id) ?? DURATION_PRESETS[2];
}

export function getVisibleDurationPresets(hiddenIds: readonly DurationPresetId[] = []): DurationPresetOption[] {
    const visiblePresets = DURATION_PRESETS.filter((preset) => !hiddenIds.includes(preset.id));
    return visiblePresets.length > 0 ? visiblePresets : [getDurationPresetById(undefined)];
}

export function getVisibleDurationPresetById(
    id: unknown,
    hiddenIds: readonly DurationPresetId[] = [],
): DurationPresetOption {
    return getVisibleDurationPresets(hiddenIds).find((preset) => preset.id === id) ?? getVisibleDurationPresets(hiddenIds)[0];
}

export function toDurationSec(value: number, unit: DurationUnit): number {
    const safeValue = Number.isFinite(value) ? value : 0;

    switch (unit) {
        case 'min':
            // Round to whole minutes before multiplying to ensure durationSec is always a multiple of 60
            // This keeps display (formatDurationValue) consistent with storage
            return Math.round(safeValue) * 60;
        case 'h':
            return Math.round(safeValue * 3600);
        case 'd':
            return Math.round(safeValue * 86400);
        default:
            return MIN_DURATION_SEC;
    }
}

export function fromDurationSec(durationSec: number, unit: DurationUnit): number {
    const safeSec = Math.max(0, durationSec);

    switch (unit) {
        case 'min':
            return safeSec / 60;
        case 'h':
            return safeSec / 3600;
        case 'd':
            return safeSec / 86400;
        default:
            return safeSec / 60;
    }
}

/**
 * Ensures the duration is a finite number and at least the minimum allowed.
 * Rounds to the nearest whole second.
 */
export function clampDurationSec(durationSec: number): number {
    const safeSec = Number.isFinite(durationSec) ? durationSec : MIN_DURATION_SEC;
    return Math.max(MIN_DURATION_SEC, Math.round(safeSec));
}

/** Formats the duration value for display based on the unit.
 * - For minutes, it rounds to the nearest whole number.
 * - For hours and days, it keeps up to 4 decimal places for values < 10, otherwise 2.
 */
export function formatDurationValue(durationSec: number, unit: DurationUnit): string {
    const rawValue = fromDurationSec(durationSec, unit);

    // minutes are usually called whole minutes
    if (unit === 'min') {
        return String(Number(rawValue.toFixed(0)));
    }

    // for hours/days we leave the fractional part, but without excess part
    const precision = rawValue >= 10 ? 2 : 4;
    return String(Number(rawValue.toFixed(precision)));
}