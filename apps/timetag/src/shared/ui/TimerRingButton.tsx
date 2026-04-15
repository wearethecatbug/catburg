'use client';

import React from 'react';
import type { UrgencyLevel } from '@/domain/task.types';
import { PlayIcon, PauseIcon } from '@/shared/icons';
import { getRemainingRatio, getTimerClusterVisualState } from '@/domain/timer.ring';

type Props = {
    isRunning: boolean;
    isPaused: boolean;

    remainingSec: number;
    totalSec: number;

    urgency?: UrgencyLevel; // IMPORTANT: already computed outside (TaskRow/store selector)
    disabled?: boolean;
    onToggleAction?: () => void;
    embedded?: boolean;

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
                                    embedded = false,
                                    sizePx = 28,
                                    strokeWidth = 3,
                                }: Props) {
    const gradientId = React.useId();
    let ratio = getRemainingRatio(remainingSec, totalSec);

    const isOverdue = remainingSec <= 0 || urgency === 'overdue';
    if (isOverdue) {
        ratio = 1;
    }

    const visualState = getTimerClusterVisualState({
        remainingSec,
        timerStatus: isRunning ? 'running' : isPaused ? 'paused' : remainingSec <= 0 ? 'expired' : 'idle',
        urgency,
        disabled,
    });

    const r = 15;
    const cx = 18;
    const cy = 18;
    const circ = 2 * Math.PI * r;
    const dashoffset = circ * (1 - ratio);

    const iconColor = disabled
        ? 'var(--tt-text-soft)'
        : visualState === 'paused'
            ? 'var(--tt-chip-paused-icon)'
            : visualState === 'warn'
                ? 'var(--tt-chip-warning-text)'
                : visualState === 'danger'
                    ? 'var(--tt-chip-zero-text)'
                    : visualState === 'zero'
                        ? 'var(--tt-chip-zero-text)'
                        : visualState === 'overdue'
                            ? 'var(--tt-chip-overdue-text)'
                            : visualState === 'running'
                                ? 'var(--tt-chip-active-icon)'
                                : 'var(--tt-chip-idle-icon)';

    const progressStroke = disabled
        ? 'var(--tt-border-strong)'
        : visualState === 'paused'
            ? `url(#${gradientId}-paused)`
            : visualState === 'warn'
                ? `url(#${gradientId}-warn)`
                : visualState === 'danger'
                    ? `url(#${gradientId}-danger)`
                    : visualState === 'zero'
                        ? `url(#${gradientId}-zero)`
                        : visualState === 'overdue'
                            ? `url(#${gradientId}-overdue)`
                            : visualState === 'running'
                                ? `url(#${gradientId}-running)`
                                : `url(#${gradientId}-normal)`;

    const buttonStyle: React.CSSProperties = embedded
        ? {
            background: 'transparent',
            color: iconColor,
            width: sizePx,
            height: sizePx,
          }
        : disabled
            ? {
                background: 'var(--tt-surface-muted)',
                color: iconColor,
                width: sizePx,
                height: sizePx,
              }
        : visualState === 'paused'
            ? {
                background: 'var(--tt-chip-paused-bg)',
                color: iconColor,
                width: sizePx,
                height: sizePx,
                boxShadow: 'inset 0 0 0 1px var(--tt-chip-paused-border)',
              }
            : visualState === 'warn'
                ? {
                    background: 'var(--tt-chip-warning-bg)',
                    color: iconColor,
                    width: sizePx,
                    height: sizePx,
                    boxShadow: 'inset 0 0 0 1px var(--tt-chip-warning-border)',
                  }
            : visualState === 'danger'
                ? {
                    background: 'var(--tt-chip-zero-bg)',
                    color: iconColor,
                    width: sizePx,
                    height: sizePx,
                    boxShadow: 'inset 0 0 0 1px var(--tt-chip-zero-border)',
                  }
            : visualState === 'zero'
                ? {
                    background: 'var(--tt-chip-zero-bg)',
                    color: iconColor,
                    width: sizePx,
                    height: sizePx,
                    boxShadow: 'inset 0 0 0 1px var(--tt-chip-zero-border)',
                  }
            : visualState === 'overdue'
                ? {
                    background: 'var(--tt-chip-overdue-bg)',
                    color: iconColor,
                    width: sizePx,
                    height: sizePx,
                  }
            : visualState === 'running'
                ? {
                    background: 'var(--tt-chip-active-bg)',
                    color: iconColor,
                    width: sizePx,
                    height: sizePx,
                    boxShadow: 'inset 0 0 0 1px var(--tt-chip-active-border)',
                  }
            : {
                background: 'var(--tt-chip-idle-bg)',
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
                disabled
                    ? 'cursor-not-allowed opacity-60'
                    : embedded
                        ? 'hover:scale-[1.02] active:scale-[0.98]'
                        : 'hover:scale-[1.02] hover:shadow-[var(--tt-shadow-soft)] active:scale-[0.98]',
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
                    <linearGradient id={`${gradientId}-running`} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--tt-ring-running-from)" />
                        <stop offset="100%" stopColor="var(--tt-ring-running-to)" />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-paused`} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--tt-ring-paused-from)" />
                        <stop offset="100%" stopColor="var(--tt-ring-paused-to)" />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-zero`} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--tt-ring-zero-from)" />
                        <stop offset="100%" stopColor="var(--tt-ring-zero-to)" />
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