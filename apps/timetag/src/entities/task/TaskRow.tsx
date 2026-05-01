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
  onRestartTimer: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

const CONTENT_ACTIONS_GAP_CLASS_NAMES = {
  compact: 'ml-6',
  comfortable: 'ml-4',
  wide: 'ml-5',
} as const;

const CONTENT_BLOCK_MAX_WIDTH_BY_MODE = {
  compact: '56%',
  comfortable: '70%',
  wide: '70%',
} as const;

export function TaskRow({
  task,
  isSelected,
  onToggleSelect,
  onToggleStatus,
  onToggleTimer,
  onResetTimer,
  onRestartTimer,
  onArchive,
  onRestore,
  onDelete,
}: TaskRowProps) {
  const { settings } = useSettings();
  const showUrgencyIndicator = settings.general.showUrgencyIndicator;
  const viewModel = getTaskRowViewModel(task, {
    showUrgencyIndicator,
    timerBehaviorSettings: {
      doubleClickRestartEnabled: settings.general.doubleClickRestartEnabled,
      autoStartAfterDoubleClickRestart: settings.general.autoStartAfterDoubleClickRestart,
    },
  });
  const showNotePreview = settings.general.showNotePreviewsInTaskList;
  const hasInlineNotePreview = viewModel.hasNoteText && showNotePreview;
  const contentActionsGapClassName = CONTENT_ACTIONS_GAP_CLASS_NAMES[settings.appearance.contentWidthMode];
  const contentBlockMaxWidth = CONTENT_BLOCK_MAX_WIDTH_BY_MODE[settings.appearance.contentWidthMode];

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
      <div className="flex h-[40px] w-[52px] shrink-0 items-center gap-2">
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
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start text-sm">
          <TaskMetaCluster
            showUrgentIndicator={viewModel.showUrgentIndicator}
            reservePrioritySlot={showUrgencyIndicator}
            showNoteIndicator={viewModel.hasNoteText && !showNotePreview}
            reserveNoteSlot={!showNotePreview}
            noteTitle={viewModel.hasNoteText ? viewModel.noteText : undefined}
            status={task.status}
          />

          <div
            data-testid="task-content-block"
            className={`flex min-h-[40px] min-w-0 flex-1 flex-col ${hasInlineNotePreview ? 'justify-start' : 'justify-center'}`}
            style={{ maxWidth: contentBlockMaxWidth }}
          >
            <span
              data-testid="task-title"
              className={`block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-medium leading-5 ${
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

            {hasInlineNotePreview && (
              <div
                data-testid="task-note-preview"
                className="mt-1 overflow-hidden text-[12px] leading-[1.3]"
                style={{
                  color: 'var(--tt-text-soft)',
                  opacity: task.status === 'done' ? 0.72 : 1,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 1,
                }}
                title={viewModel.noteText}
              >
                {viewModel.notePreview}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`flex min-w-[168px] shrink-0 items-center justify-end gap-3 whitespace-nowrap ${contentActionsGapClassName}`}>
        <TaskTimerCluster
          status={task.status}
          remainingSec={task.remainingSec}
          totalSec={task.originalDurationSec}
          urgency={viewModel.urgency}
          showTimerButton={viewModel.showTimerButton}
          isRunning={viewModel.isRunning}
          isPaused={viewModel.isPaused}
          isTimerDisabled={viewModel.isTimerDisabled}
          shouldInterceptDoubleClickGesture={viewModel.shouldInterceptDoubleClickGesture}
          isDoubleClickRestartEnabled={viewModel.isDoubleClickRestartEnabled}
          timerDisplay={viewModel.timerDisplay}
          fullTimeText={viewModel.fullTimeText}
          onToggleTimer={() => onToggleTimer(task.id)}
          onRestartTimer={() => onRestartTimer(task.id)}
        />

        <TaskRowActionsMenu
          status={task.status}
          showResetTimer={viewModel.showTimerButton}
          onResetTimer={() => onResetTimer(task.id)}
          onToggleStatus={() => onToggleStatus(task.id)}
          onArchive={() => onArchive(task.id)}
          onRestore={() => onRestore(task.id)}
          onDelete={() => onDelete(task.id)}
        />
      </div>
    </div>
  );
}