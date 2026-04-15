'use client';

import React from 'react';
import type { Task } from '@/domain/task.types';
import {
  Dropdown,
  DropdownItem,
  DropdownDivider,
  MoreVerticalIcon,
  TimerRingButton,
} from '@/shared';
import { useSettings } from '@/store';
import { formatTimeBadge } from '@/domain/helpers';
import { getTimeDisplay } from '@/shared/utils/formatTime';
import { getUrgencyLevel } from '@/domain/task.urgency';
import { getTimerClusterVisualState } from '@/domain/timer.ring';
import { SelectionCheckbox } from './SelectionCheckbox';
import { TaskMetaCluster } from './TaskMetaCluster';
import { TaskStatusToggle } from './TaskStatusToggle';

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

  const isTimerDisabled = task.status !== 'active';
  const trimmedNote = task.note?.trim() ?? '';
  const hasNote = Boolean(trimmedNote);
  const showUrgentIndicator = settings.general.showUrgencyIndicator && task.priority === 'urgent';
  const showMetaCluster = showUrgentIndicator || hasNote;
  const notePreview = hasNote ? trimmedNote.split(/\r?\n/, 1)[0] : '';

  // Calculate urgency level for timer ring visualization
  const urgency = getUrgencyLevel(task);

  const getDisplayTime = (): string => {
    // For pomodoro mode: show cycles and work duration
    if (task.timerMode === 'pomodoro' && task.pomodoro) {
      return `${task.pomodoro.cycles}×${task.pomodoro.workDurationMin}m`;
    }

    // For deadline mode with > 24 hours, show days; otherwise use standard format
    if (task.timerMode === 'deadline' && task.remainingSec > 86400) {
      const timeDisplay = getTimeDisplay(task.remainingSec);
      return timeDisplay.short;
    }

    return formatTimeBadge(task.remainingSec);
  };

  const getFullTimeText = (): string => {
    // For pomodoro mode: show detailed breakdown
    if (task.timerMode === 'pomodoro' && task.pomodoro) {
      return `${task.pomodoro.cycles} cycles: ${task.pomodoro.workDurationMin}m work, ${task.pomodoro.shortBreakMin}m break, ${task.pomodoro.longBreakMin}m long break`;
    }

    // Full tooltip text for deadline mode
    if (task.timerMode === 'deadline') {
      const timeDisplay = getTimeDisplay(task.remainingSec);
      return timeDisplay.full;
    }

    // For duration mode: use full format (includes days, hours, minutes, seconds)
    const timeDisplay = getTimeDisplay(task.remainingSec);
    return timeDisplay.full;
  };

  const rowBackground = isSelected ? 'rgba(59, 130, 246, 0.03)' : 'transparent';
  const rowBoxShadow = isSelected ? 'inset 0 0 0 1px rgba(59, 130, 246, 0.08)' : undefined;
  const isPaused = task.timerStatus === 'paused';
  const isRunning = task.timerStatus === 'running';
  const timerVisualState = getTimerClusterVisualState({
    remainingSec: task.remainingSec,
    timerStatus: task.timerStatus,
    urgency,
    disabled: isTimerDisabled,
  });
  const timerClusterStyle: React.CSSProperties = task.status === 'archived'
    ? {
        background: 'var(--tt-surface-subtle)',
        color: 'var(--tt-text-soft)',
        opacity: 0.8,
      }
    : task.status === 'done'
      ? {
          background: '#F8FAFC',
          color: 'var(--tt-text-soft)',
          opacity: 0.72,
        }
    : timerVisualState === 'disabled' || timerVisualState === 'idle'
      ? {
          background: 'var(--tt-chip-idle-bg)',
          color: 'var(--tt-chip-idle-text)',
        }
      : timerVisualState === 'paused'
        ? {
            background: 'var(--tt-chip-paused-bg)',
            color: 'var(--tt-chip-paused-text)',
          }
      : timerVisualState === 'running'
        ? {
            background: 'var(--tt-chip-active-bg)',
            color: 'var(--tt-chip-active-text)',
            boxShadow: 'inset 0 0 0 1px rgba(79, 125, 243, 0.10)',
          }
      : timerVisualState === 'warn'
        ? {
            background: 'var(--tt-chip-warning-bg)',
            color: 'var(--tt-chip-warning-text)',
            boxShadow: 'inset 0 0 0 1px rgba(221, 198, 82, 0.24)',
          }
      : timerVisualState === 'danger'
        ? {
            background: 'var(--tt-chip-zero-bg)',
            color: 'var(--tt-chip-zero-text)',
            boxShadow: 'inset 0 0 0 1px var(--tt-chip-zero-border)',
          }
      : timerVisualState === 'zero'
        ? {
            background: 'var(--tt-chip-zero-bg)',
            color: 'var(--tt-chip-zero-text)',
            boxShadow: 'inset 0 0 0 1px var(--tt-chip-zero-border)',
          }
      : timerVisualState === 'overdue'
      ? {
          background: 'var(--tt-chip-overdue-bg)',
          color: 'var(--tt-chip-overdue-text)',
        }
      : {
          background: 'var(--tt-chip-idle-bg)',
          color: 'var(--tt-chip-idle-text)',
        };
  const timerValueStyle: React.CSSProperties = task.status === 'archived'
    ? { color: 'var(--tt-text-soft)' }
    : task.status === 'done'
      ? { color: 'var(--tt-text-soft)' }
    : timerVisualState === 'disabled' || timerVisualState === 'idle'
      ? { color: 'var(--tt-chip-idle-text)' }
      : timerVisualState === 'paused'
        ? { color: 'var(--tt-chip-paused-text)' }
      : timerVisualState === 'running'
        ? { color: 'var(--tt-chip-active-text)' }
      : timerVisualState === 'warn'
        ? { color: 'var(--tt-chip-warning-text)' }
      : timerVisualState === 'danger'
          ? { color: 'var(--tt-chip-zero-text)' }
      : timerVisualState === 'zero'
        ? { color: 'var(--tt-chip-zero-text)' }
      : timerVisualState === 'overdue'
          ? { color: 'var(--tt-chip-overdue-text)' }
      : { color: 'var(--tt-chip-idle-text)' };

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
            {showMetaCluster && (
                <TaskMetaCluster
                    showUrgentIndicator={showUrgentIndicator}
                    hasNote={hasNote}
                    noteTitle={trimmedNote}
                />
            )}
            <div className="min-w-0 flex-1">
              <span
                  data-testid="task-title"
                  className={`block min-w-0 truncate text-[15px] font-medium leading-5 ${
                      task.status === 'done' ? 'line-through' : ''
                  }`}
                  style={task.status === 'done'
                    ? { color: '#94A3B8', opacity: 0.9 }
                    : task.status === 'archived'
                      ? { color: 'var(--tt-text-soft)' }
                    : { color: 'var(--tt-text)' }}
              >
                {task.title}
              </span>

              {hasNote && settings.general.showNotePreviewsInTaskList && (
                  <div
                      data-testid="task-note-preview"
                      className="mt-1 overflow-hidden pr-2 text-[12px] leading-[1.3]"
                      style={{
                        color: task.status === 'done' ? '#CBD5E1' : 'var(--tt-text-soft)',
                        opacity: 1,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 1,
                      }}
                      title={trimmedNote}
                  >
                    {notePreview}
                  </div>
              )}
            </div>
          </div>
        </div>

        <div
            data-testid="task-timer-cluster"
            title={getFullTimeText()}
            className="ml-1 inline-flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1"
            style={timerClusterStyle}
        >
          <TimerRingButton
              isRunning={isRunning}
              isPaused={isPaused}
              remainingSec={task.remainingSec}
              totalSec={task.originalDurationSec}
              urgency={urgency}
              disabled={isTimerDisabled}
              onToggleAction={() => onToggleTimer(task.id)}
              sizePx={30}
              strokeWidth={2.75}
              embedded
          />

          <span
              className="min-w-[56px] pr-1 text-right text-[13px] font-medium tabular-nums leading-none"
              style={timerValueStyle}
          >
            {getDisplayTime()}
          </span>
        </div>

        <div className="ml-3 shrink-0">
          <Dropdown
            trigger={
              <span
                  className="rounded-lg p-1.5 transition-colors group-hover:bg-[var(--tt-row-hover)]"
                  style={{ color: 'var(--tt-text-soft)' }}
              >
                <MoreVerticalIcon size="sm" aria-label="Task options" />
              </span>
            }
            align="right"
          >
            <DropdownItem onClick={() => onResetTimer(task.id)}>Reset timer</DropdownItem>
            <DropdownItem onClick={() => onToggleStatus(task.id)}>
              {task.status === 'done' ? 'Reopen' : 'Mark as done'}
            </DropdownItem>
            {task.status !== 'archived' ? (
                <DropdownItem onClick={() => onArchive(task.id)}>Archive</DropdownItem>
            ) : (
                <DropdownItem onClick={() => onRestore(task.id)}>Restore</DropdownItem>
            )}
            <DropdownDivider />
            <DropdownItem onClick={() => onDelete(task.id)} danger>
              Delete
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
  );
}