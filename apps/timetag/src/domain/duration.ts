export type DurationUnit = 'min' | 'h' | 'd';

export const MIN_DURATION_SEC = 60;

export function toDurationSec(value: number, unit: DurationUnit): number {
    const safeValue = Number.isFinite(value) ? value : 0;

    switch (unit) {
        case 'min':
            return Math.round(safeValue * 60);
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