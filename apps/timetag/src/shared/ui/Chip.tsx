'use client';

import React from 'react';
import { CloseIcon } from '@/shared/icons';

interface ChipProps {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}

export function Chip({ children, onRemove, className = '' }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 ${className}`}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:bg-blue-200 rounded-full p-0.5"
          aria-label="Remove"
        >
          <CloseIcon size="xs" />
        </button>
      )}
    </span>
  );
}

