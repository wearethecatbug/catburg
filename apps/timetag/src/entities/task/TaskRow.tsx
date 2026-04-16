'use client';

import React from 'react';
import type { Task } from '@/domain/task.types';
import { useSettings } from '@/store';
import {
  SelectionCheckbox,
  TaskMetaCluster,
  TaskRowActionsMenu,
  TaskStatusToggle,
  TaskTimerCluster,
} from './components';
import { getTaskRowViewModel } from './task-row.viewmodel';

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onToggleTimer: (id: string) => void;
  onResetTimer: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskRow({
  task,
  isSelected,
  onToggleSelect,
  onToggleStatus,
  onToggleTimer,
  onResetTimer,
  onArchive,
  onRestore,
  onDelete,
}: TaskRowProps) {
  const { settings } = useSettings();
  const viewModel = getTaskRowViewModel(task, {
    showUrgencyIndicator: settings.general.showUrgencyIndicator,
  });

  const rowBackground = isSelected ? 'var(--tt-selected-row-bg)' : 'transparent';
  const rowBoxShadow = isSelected ? 'inset 0 0 0 1px var(--tt-selected-row-border)' : undefined;

  return (
      <div
          data-testid="task-row"
          data-task-id={task.id}
          className="group flex items-center gap-2 px-3 py-2.5 transition-[background-color,box-shadow] hover:bg-[var(--tt-row-hover)] hover:shadow-[var(--tt-shadow-soft)]"
          style={{
            background: rowBackground,
            boxShadow: rowBoxShadow,
          }}
      >
        <SelectionCheckbox
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            ariaLabel={`Select ${task.title}`}
        />

        <TaskStatusToggle
            status={task.status}
            isSelected={isSelected}
            onToggle={() => onToggleStatus(task.id)}
        />

        <div className="min-w-0 flex-1 pr-2">
          <div className="flex min-w-0 items-start text-sm">
            {viewModel.showMetaCluster && (
                <TaskMetaCluster
                    showUrgentIndicator={viewModel.showUrgentIndicator}
                    hasNote={viewModel.hasNote}
                    noteTitle={viewModel.trimmedNote}
                />
            )}
            <div className="min-w-0 flex-1">
              <span
                  data-testid="task-title"
                  className={`block min-w-0 truncate text-[15px] font-medium leading-5 ${
                      task.status === 'done' ? 'line-through' : ''
                  }`}
                  style={task.status === 'done'
                    ? { color: 'var(--tt-text-soft)', opacity: 0.9 }
                    : task.status === 'archived'
                      ? { color: 'var(--tt-text-soft)' }
                    : { color: 'var(--tt-text)' }}
              >
                {task.title}
              </span>

              {viewModel.hasNote && settings.general.showNotePreviewsInTaskList && (
                  <div
                      data-testid="task-note-preview"
                      className="mt-1 overflow-hidden pr-2 text-[12px] leading-[1.3]"
                      style={{
                        color: 'var(--tt-text-soft)',
                        opacity: task.status === 'done' ? 0.72 : 1,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 1,
                      }}
                      title={viewModel.trimmedNote}
                  >
                    {viewModel.notePreview}
                  </div>
              )}
            </div>
          </div>
        </div>

        <TaskTimerCluster
          status={task.status}
          remainingSec={task.remainingSec}
          totalSec={task.originalDurationSec}
          urgency={viewModel.urgency}
          isRunning={viewModel.isRunning}
          isPaused={viewModel.isPaused}
          isTimerDisabled={viewModel.isTimerDisabled}
          displayTime={viewModel.displayTime}
          fullTimeText={viewModel.fullTimeText}
          onToggleTimer={() => onToggleTimer(task.id)}
        />

        <TaskRowActionsMenu
          status={task.status}
          onResetTimer={() => onResetTimer(task.id)}
          onToggleStatus={() => onToggleStatus(task.id)}
          onArchive={() => onArchive(task.id)}
          onRestore={() => onRestore(task.id)}
          onDelete={() => onDelete(task.id)}
        />
      </div>
  );
}