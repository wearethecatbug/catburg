'use client';

import React from 'react';
import type { UrgencyLevel } from '@/domain/task.types';
import { PlayIcon, PauseIcon } from '@/shared';
import { getRemainingRatio, getRingColorClass } from '@/domain/timer.ring';

type Props = {
    isRunning: boolean;
    isPaused: boolean;

    remainingSec: number;
    totalSec: number;

    urgency?: UrgencyLevel; // IMPORTANT: already computed outside (TaskRow/store selector)
    disabled?: boolean;
    onClick?: () => void;

    sizePx?: number; // default 28 (more compact like screenshot)
    strokeWidth?: number; // default 3
};

export function TimerRingButton({
                                    isRunning,
                                    isPaused,
                                    remainingSec,
                                    totalSec,
                                    urgency,
                                    disabled,
                                    onClick,
                                    sizePx = 28,
                                    strokeWidth = 3,
                                }: Props) {
    // Calculate ratio for ring fill
    let ratio = getRemainingRatio(remainingSec, totalSec);

    // For overdue (expired or negative time) - show FULL ring (100% filled) instead of empty
    // This makes the black ring completely filled to emphasize urgency
    const isOverdue = remainingSec <= 0 || urgency === 'overdue';
    if (isOverdue) {
        ratio = 1; // Full circle for overdue state
    }

    const colorClass = getRingColorClass({
        ratio01: remainingSec <= 0 ? 0 : ratio, // Pass 0 for overdue to trigger black color
        urgency,
        disabled,
        paused: isPaused,
    });


    // SVG geometry (viewBox 36x36)
    const r = 15;
    const cx = 18;
    const cy = 18;
    const circ = 2 * Math.PI * r;
    const dashoffset = circ * (1 - ratio);

    const surfaceBase =
        'border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10';

    // Pause “mode”: warmer + sepia (optional “inversion vibe”, without breaking theme)
    const surfacePaused =
        'border-amber-200/50 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-400/10 sepia saturate-50';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
            className={[
                'relative inline-grid shrink-0 place-items-center rounded-full',
                'transition-colors',
                isPaused ? surfacePaused : surfaceBase,
                disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-black/10 dark:hover:bg-white/15',
                colorClass, // controls ring color: dark gray when paused, black when overdue, colored otherwise
            ].join(' ')}
            style={{ width: sizePx, height: sizePx }}
        >
            <svg
                aria-hidden
                className="absolute inset-0"
                viewBox="0 0 36 36"
                width={sizePx}
                height={sizePx}
            >
                {/* track */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.35)"
                    strokeWidth={strokeWidth}
                />
                {/* progress */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={dashoffset}
                    transform={`rotate(-90 ${cx} ${cy})`}
                />
            </svg>

            <span className="relative z-10">
        {/* UX: running -> pause, paused -> play (resume) */}
                {isRunning ? <PauseIcon size="sm" /> : <PlayIcon size="sm" />}
      </span>
        </button>
    );
}