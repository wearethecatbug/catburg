'use client';

import React from 'react';
import { CloseIcon } from '@/shared/icons';

type ChipTone = 'neutral' | 'info' | 'warning' | 'danger';

interface ChipProps {
    children: React.ReactNode;
    onRemove?: () => void;
    className?: string;
    tone?: ChipTone;
    style?: React.CSSProperties;
}

/**
 * Chip — pill label. Default is NEUTRAL.
 */
export function Chip({
                         children,
                         onRemove,
                         className = '',
                         tone = 'neutral',
                         style,
                     }: ChipProps) {
    const base =
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors';

    const toneStyle: React.CSSProperties = tone === 'info'
        ? {
            borderColor: 'transparent',
            background: 'var(--tt-chip-active-bg)',
            color: 'var(--tt-chip-active-text)',
          }
        : tone === 'warning'
            ? {
                borderColor: 'transparent',
                background: 'var(--tt-chip-warning-bg)',
                color: 'var(--tt-chip-warning-text)',
              }
            : tone === 'danger'
                ? {
                    borderColor: 'transparent',
                    background: 'var(--tt-chip-danger-bg)',
                    color: 'var(--tt-chip-danger-text)',
                  }
                : {
                    borderColor: 'transparent',
                    background: 'var(--tt-chip-bg)',
                    color: 'var(--tt-chip-text)',
                  };

    return (
        <span className={`${base} ${className}`} style={{ ...toneStyle, ...style }} role="status">
            <span>{children}</span>

            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="rounded-full p-1 transition-colors hover:bg-[var(--tt-surface-hover)]"
                    aria-label="Remove"
                >
                    <CloseIcon size="sm" />
                </button>
            )}
        </span>
    );
}

