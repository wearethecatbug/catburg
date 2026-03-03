'use client';

import React from 'react';
import { CloseIcon } from '@/shared/icons';

type ChipTone = 'neutral' | 'info';

interface ChipProps {
    children: React.ReactNode;
    onRemove?: () => void;
    className?: string;
    tone?: ChipTone;
}

/**
 * Chip — pill label. Default is NEUTRAL.
 */
export function Chip({
                         children,
                         onRemove,
                         className = '',
                         tone = 'neutral',
                     }: ChipProps) {
    const base =
        'inline-flex items-center gap-2 rounded-full border px-3 text-sm font-medium';

    const neutral =
        'h-7 border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/80';

    const info =
        'h-7 border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200';

    const toneClass = tone === 'info' ? info : neutral;

    return (
        <span className={`${base} ${toneClass} ${className}`} role="status">
      <span>{children}</span>

            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label="Remove"
                >
                    <CloseIcon size="sm" />
                </button>
            )}
    </span>
    );
}

