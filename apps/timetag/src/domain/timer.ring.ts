import { UrgencyLevel } from '@/domain/task.types';
import type { TimerStatus } from '@/domain/task.types';

export type TimerRingTone = 'normal' | 'warn' | 'danger' | 'overdue';
export type TimerRingVisualTone = TimerRingTone | 'paused' | 'disabled';
export type TimerClusterVisualState = 'disabled' | 'idle' | 'running' | 'paused' | 'warn' | 'danger' | 'zero' | 'overdue';

export function clamp01(v: number): number {
    if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

export function getRemainingRatio(remainingSec: number, totalSec: number): number {
    if (!totalSec || totalSec <= 0) return 1;
    return clamp01(remainingSec / totalSec);
}

export function getRingToneByRatio(ratio01: number): TimerRingTone {
    const r = clamp01(ratio01);
    if (r <= 0) return 'overdue';
    if (r <= 0.2) return 'danger';
    if (r <= 0.5) return 'warn';
    return 'normal';
}

export function getRingVisualTone(args: {
    urgency?: UrgencyLevel;
    ratio01?: number;
    disabled?: boolean;
    paused?: boolean;
}): TimerRingVisualTone {
    const { urgency, ratio01, disabled, paused } = args;

    if (disabled) return 'disabled';

    if (paused) return 'paused';

    if (urgency === 'overdue') return 'overdue';
    if (typeof ratio01 === 'number' && ratio01 <= 0) return 'overdue';


    if (urgency) {
        switch (urgency) {
            case 'normal':
                return 'normal';
            case 'warn':
                return 'warn';
            case 'danger':
                return 'danger';
        }
    }

    if (typeof ratio01 === 'number') {
        const tone = getRingToneByRatio(ratio01);
        switch (tone) {
            case 'normal':
                return 'normal';
            case 'warn':
                return 'warn';
            case 'danger':
                return 'danger';
            case 'overdue':
                return 'overdue';
        }
    }

    return 'normal';
}

export function getRingColorClass(args: {
    urgency?: UrgencyLevel;
    ratio01?: number;
    disabled?: boolean;
    paused?: boolean;
}): string {
    switch (getRingVisualTone(args)) {
        case 'disabled':
            return 'text-slate-300 dark:text-slate-600';
        case 'paused':
            return 'text-slate-500 dark:text-slate-400';
        case 'warn':
            return 'text-amber-500 dark:text-amber-400';
        case 'danger':
            return 'text-rose-500 dark:text-rose-400';
        case 'overdue':
            return 'text-slate-900 dark:text-white';
        case 'normal':
        default:
            return 'text-blue-600 dark:text-blue-400';
    }
}

export function getTimerClusterVisualState(args: {
    remainingSec: number;
    timerStatus: TimerStatus;
    urgency?: UrgencyLevel;
    disabled?: boolean;
}): TimerClusterVisualState {
    const { remainingSec, timerStatus, urgency, disabled } = args;

    if (disabled) return 'disabled';
    if (timerStatus === 'paused') return 'paused';
    if (remainingSec < 0) return 'overdue';
    if (remainingSec === 0) return 'zero';

    if (urgency === 'danger') return 'danger';
    if (urgency === 'warn') return 'warn';

    switch (timerStatus) {
        case 'running':
            return 'running';
        case 'expired':
            return 'zero';
        case 'idle':
        default:
            return 'idle';
    }
}
