'use client';

import React from 'react';
import type { TaskStatus } from '@/domain/task.types';

interface TaskStatusToggleProps {
  status: TaskStatus;
  isSelected: boolean;
  onToggle: () => void;
}

export function TaskStatusToggle({ status, isSelected, onToggle }: TaskStatusToggleProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isDone = status === 'done';
  const isArchived = status === 'archived';
  const hoverBorderColor = 'var(--tt-accent-hover)';

  const statusButtonStyle: React.CSSProperties = status === 'done'
    ? {
        background: isHovered ? 'var(--tt-accent-hover)' : 'var(--tt-accent)',
        borderColor: isHovered ? hoverBorderColor : 'var(--tt-accent)',
        borderWidth: isHovered ? 1 : 2,
        color: 'var(--tt-accent-contrast)',
        boxShadow: 'none',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
      }
    : {
        borderColor: isHovered ? hoverBorderColor : 'var(--tt-border-strong)',
        background: isHovered
          ? 'var(--tt-accent-soft)'
          : isSelected
            ? 'var(--tt-surface-hover)'
            : 'var(--tt-surface)',
        borderWidth: isHovered ? 1 : 2,
        color: isHovered ? 'var(--tt-accent)' : 'transparent',
        boxShadow: 'none',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
      };

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => !isArchived && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="task-status-toggle"
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ease-out focus-visible:ring-4 focus-visible:ring-blue-100 focus-visible:ring-offset-0 ${
        isArchived ? 'opacity-50' : ''
      }`}
      style={statusButtonStyle}
      aria-label={isDone ? 'Mark as active' : 'Mark as done'}
      disabled={isArchived}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none">
        <path
          d="M5.75 12.5l4 4L18.25 8.5"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}


