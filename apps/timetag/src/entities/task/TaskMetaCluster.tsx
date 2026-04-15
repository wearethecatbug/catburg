'use client';

import React from 'react';
import { NoteIcon } from '@/shared';

interface TaskMetaClusterProps {
  showUrgentIndicator: boolean;
  hasNote: boolean;
  noteTitle?: string;
}

export function TaskMetaCluster({
  showUrgentIndicator,
  hasNote,
  noteTitle,
}: TaskMetaClusterProps) {
  if (!showUrgentIndicator && !hasNote) {
    return null;
  }

  return (
    <span
      data-testid="task-meta-cluster"
      className="mr-[10px] inline-flex h-5 shrink-0 items-center gap-1.5 self-center"
    >
      {showUrgentIndicator && (
        <span
          data-testid="task-urgent-icon"
          className="inline-flex h-4 w-4 items-center justify-center"
          style={{ color: '#F59E0B', opacity: 0.9 }}
          aria-hidden="true"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none">
            <path
              d="M12 3.5L20.4 18.6A1.2 1.2 0 0119.35 20.4H4.65A1.2 1.2 0 013.6 18.6L12 3.5z"
              fill="#FFFFFF"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M12 8.1v6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17.2" r="1.1" fill="currentColor" />
          </svg>
        </span>
      )}
      {hasNote && (
        <span
          data-testid="task-note-trigger"
          className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center"
          title={noteTitle}
          aria-label={noteTitle || 'Task note'}
        >
          <span
            className="inline-flex h-4 w-4 items-center justify-center"
            style={{ color: '#9CA3AF', opacity: 0.6 }}
            aria-hidden="true"
          >
            <NoteIcon size="sm" />
          </span>
        </span>
      )}
    </span>
  );
}

