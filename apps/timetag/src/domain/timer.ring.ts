import { UrgencyLevel } from '@/domain/task.types';

export type TimerRingTone = 'normal' | 'warn' | 'danger' | 'overdue';

export function clamp01(v: number): number {
    if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

export function getRemainingRatio(remainingSec: number, totalSec: number): number {
    if (!totalSec || totalSec <= 0) return 1; // <-- лучше 1, чтобы не уходило в "overdue" при некорректном total
    return clamp01(remainingSec / totalSec);
}

export function getRingToneByRatio(ratio01: number): TimerRingTone {
    const r = clamp01(ratio01);
    if (r <= 0) return 'overdue';
    if (r <= 0.2) return 'danger';
    if (r <= 0.5) return 'warn';
    return 'normal';
}

export function getRingColorClass(args: {
    urgency?: UrgencyLevel;
    ratio01?: number;        // <-- NEW
    disabled?: boolean;
    paused?: boolean;
}): string {
    const { urgency, ratio01, disabled, paused } = args;

    if (disabled) return 'text-gray-300';

    // Check for overdue FIRST (highest priority) - black ring
    if (urgency === 'overdue') return 'text-black dark:text-white';
    if (typeof ratio01 === 'number' && ratio01 <= 0) return 'text-black dark:text-white';

    // When paused (but not overdue), return dark gray
    if (paused) return 'text-slate-500';

    // 1) если передали urgency — используем его
    if (urgency) {
        switch (urgency) {
            case 'normal':
                return 'text-blue-500';
            case 'warn':
                return 'text-amber-500';
            case 'danger':
                return 'text-rose-500';
            // case 'overdue':
            //     return 'text-black dark:text-white'; // already handled above
        }
    }

    // 2) иначе красим по прогрессу времени
    if (typeof ratio01 === 'number') {
        const tone = getRingToneByRatio(ratio01);
        switch (tone) {
            case 'normal':
                return 'text-blue-500';
            case 'warn':
                return 'text-amber-500';
            case 'danger':
                return 'text-rose-500';
            case 'overdue':
                return 'text-black dark:text-white'; // already handled above
        }
    }

    // 3) fallback
    return 'text-blue-500';
}