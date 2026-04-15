'use client';

import React from 'react';
import { NoteIcon, UrgentWarningIcon } from '@/shared';

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
  const noteDescriptionId = React.useId();

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
          style={{ color: 'var(--tt-chip-warning-text)', opacity: 0.9 }}
          aria-hidden="true"
        >
          <UrgentWarningIcon size="sm" aria-hidden />
        </span>
      )}
      {hasNote && (
        <span
          data-testid="task-note-trigger"
          className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center"
          role="img"
          tabIndex={0}
          title={noteTitle}
          aria-label="Task has note"
          aria-describedby={noteTitle ? noteDescriptionId : undefined}
        >
          <span
            className="inline-flex h-4 w-4 items-center justify-center"
            style={{ color: 'var(--tt-text-soft)', opacity: 0.6 }}
            aria-hidden="true"
          >
            <NoteIcon size="sm" />
          </span>
          {noteTitle && (
            <span id={noteDescriptionId} className="sr-only">
              {noteTitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

