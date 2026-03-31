'use client';

import React from 'react';
import type { UrgencyLevel } from '@/domain/task.types';
import { PlayIcon, PauseIcon } from '@/shared';
import { getRemainingRatio, getRingVisualTone } from '@/domain/timer.ring';

type Props = {
    isRunning: boolean;
    isPaused: boolean;

    remainingSec: number;
    totalSec: number;

    urgency?: UrgencyLevel; // IMPORTANT: already computed outside (TaskRow/store selector)
    disabled?: boolean;
    onToggleAction?: () => void;

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
                                    onToggleAction,
                                    sizePx = 28,
                                    strokeWidth = 3,
                                }: Props) {
    const gradientId = React.useId();
    let ratio = getRemainingRatio(remainingSec, totalSec);

    const isOverdue = remainingSec <= 0 || urgency === 'overdue';
    if (isOverdue) {
        ratio = 1;
    }

    const ringTone = getRingVisualTone({
        ratio01: remainingSec <= 0 ? 0 : ratio,
        urgency,
        disabled,
        paused: isPaused,
    });

    const r = 15;
    const cx = 18;
    const cy = 18;
    const circ = 2 * Math.PI * r;
    const dashoffset = circ * (1 - ratio);

    const iconColor = disabled
        ? 'var(--tt-text-soft)'
        : ringTone === 'paused'
            ? 'var(--tt-text-muted)'
            : ringTone === 'warn'
                ? 'var(--tt-chip-warning-text)'
                : ringTone === 'danger'
                    ? 'var(--tt-chip-danger-text)'
                    : ringTone === 'overdue'
                        ? '#8a4747'
                        : 'var(--tt-accent)';

    const progressStroke = disabled
        ? 'var(--tt-border-strong)'
        : ringTone === 'paused'
            ? 'var(--tt-text-soft)'
            : `url(#${gradientId}-${ringTone})`;

    const buttonStyle: React.CSSProperties = disabled
        ? {
            background: 'var(--tt-surface-muted)',
            color: iconColor,
            width: sizePx,
            height: sizePx,
          }
        : isPaused
            ? {
                background: 'var(--tt-surface-subtle)',
                color: iconColor,
                width: sizePx,
                height: sizePx,
              }
            : ringTone === 'overdue'
                ? {
                    background: '#fcf3f3',
                    color: iconColor,
                    width: sizePx,
                    height: sizePx,
                  }
            : {
                background: 'var(--tt-surface)',
                color: iconColor,
                width: sizePx,
                height: sizePx,
              };

    return (
        <button
            type="button"
            onClick={onToggleAction}
            disabled={disabled}
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
            className={[
                'relative inline-grid shrink-0 place-items-center rounded-full border border-transparent',
                'transition-all duration-150',
                disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-[1.02] hover:shadow-[var(--tt-shadow-soft)] active:scale-[0.98]',
            ].join(' ')}
            style={buttonStyle}
        >
            <svg
                aria-hidden
                className="absolute inset-0"
                viewBox="0 0 36 36"
                width={sizePx}
                height={sizePx}
            >
                <defs>
                    <linearGradient id={`${gradientId}-normal`} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--tt-ring-normal-from)" />
                        <stop offset="100%" stopColor="var(--tt-ring-normal-to)" />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-warn`} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--tt-ring-warn-from)" />
                        <stop offset="100%" stopColor="var(--tt-ring-warn-to)" />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-danger`} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--tt-ring-danger-from)" />
                        <stop offset="100%" stopColor="var(--tt-ring-danger-to)" />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-overdue`} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--tt-ring-overdue-from)" />
                        <stop offset="100%" stopColor="var(--tt-ring-overdue-to)" />
                    </linearGradient>
                </defs>
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke="var(--tt-ring-track)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={progressStroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={dashoffset}
                    transform={`rotate(-90 ${cx} ${cy})`}
                    style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.2s ease' }}
                />
            </svg>

            <span className="relative z-10">
                {isRunning ? <PauseIcon size="sm" /> : <PlayIcon size="sm" />}
            </span>
        </button>
    );
}