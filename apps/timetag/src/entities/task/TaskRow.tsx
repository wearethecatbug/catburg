'use client';

import React from 'react';
import type { Task } from '@/domain/task.types';
import {
  Chip,
  Dropdown,
  DropdownItem,
  DropdownDivider,
  Checkbox,
  CheckIcon,
  MoreVerticalIcon,
  NoteIcon,
  TimerRingButton,
  UrgentWarningIcon,
} from '@/shared';
import { useSettings } from '@/store';
import { formatTimeBadge } from '@/domain/helpers';
import { getTimeDisplay } from '@/shared/utils/formatTime';
import { getUrgencyLevel } from '@/domain/task.urgency';

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
  const notePreviewRef = React.useRef<HTMLSpanElement | null>(null);
  const notePopoverId = React.useId();
  const [isNoteHovered, setIsNoteHovered] = React.useState(false);
  const [isNoteFocused, setIsNoteFocused] = React.useState(false);
  const [isNotePinned, setIsNotePinned] = React.useState(false);
  const [suppressTransientPreview, setSuppressTransientPreview] = React.useState(false);

  const preventMouseFocus = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
  };

  const isTimerDisabled = task.status !== 'active';
  const trimmedNote = task.note?.trim() ?? '';
  const hasNote = Boolean(trimmedNote);
  const notePreview = hasNote ? trimmedNote.split(/\r?\n/, 1)[0] : '';
  const isNotePreviewOpen = hasNote && (isNotePinned || (!suppressTransientPreview && (isNoteHovered || isNoteFocused)));

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

  const rowBackground = isSelected ? 'var(--tt-accent-soft)' : 'transparent';
  const rowBoxShadow = isSelected ? 'inset 0 0 0 1px rgba(79, 125, 243, 0.10)' : undefined;
  const statusButtonStyle: React.CSSProperties = task.status === 'done'
    ? {
        background: '#16a34a',
        borderColor: '#16a34a',
        color: '#ffffff',
      }
    : {
        borderColor: 'var(--tt-border-strong)',
        background: isSelected ? 'rgba(255, 255, 255, 0.78)' : 'var(--tt-surface)',
        color: 'var(--tt-text-soft)',
      };
  const isPaused = task.timerStatus === 'paused';
  const timeChipTone = task.status === 'archived'
    ? 'neutral'
    : urgency === 'overdue'
      ? 'danger'
      : isPaused
        ? 'neutral'
        : urgency === 'danger'
          ? 'danger'
          : urgency === 'warn'
            ? 'warning'
            : task.timerStatus === 'running'
              ? 'info'
              : 'neutral';
  const timeChipStyle: React.CSSProperties = task.status === 'archived'
    ? {
        color: 'var(--tt-text-soft)',
        opacity: 0.78,
      }
    : isPaused
      ? {
          borderColor: 'var(--tt-border)',
          background: 'var(--tt-surface-subtle)',
          color: 'var(--tt-text-muted)',
        }
    : urgency === 'overdue'
      ? {
          background: '#f8eded',
          color: '#8a4747',
        }
    : {};

  const handleNoteToggle = () => {
    setIsNotePinned((prev) => {
      const next = !prev;
      setSuppressTransientPreview(!next);
      return next;
    });
  };

  React.useEffect(() => {
    if (!isNotePinned) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!notePreviewRef.current?.contains(event.target as Node)) {
        setIsNotePinned(false);
        setSuppressTransientPreview(true);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsNotePinned(false);
      setSuppressTransientPreview(true);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotePinned]);

  return (
      <div
          className="group flex items-center gap-3.5 px-4 py-3 transition-[background-color,box-shadow] hover:bg-[var(--tt-row-hover)] hover:shadow-[var(--tt-shadow-soft)]"
          style={{
            background: rowBackground,
            boxShadow: rowBoxShadow,
          }}
      >
        <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            aria-label={`Select ${task.title}`}
        />

        <button
            type="button"
            onClick={() => onToggleStatus(task.id)}
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                task.status === 'archived' ? 'opacity-50' : 'hover:scale-[1.03]'
            }`}
            style={statusButtonStyle}
            aria-label={task.status === 'done' ? 'Mark as active' : 'Mark as done'}
            disabled={task.status === 'archived'}
        >
          {task.status === 'done' && <CheckIcon size="xs" />}
        </button>

        <div className="min-w-0 flex-1 pr-2">
          <div className="flex min-w-0 items-start gap-2 text-sm">
            {settings.general.showUrgencyIndicator && task.priority === 'urgent' && (
                <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center pt-0.5"
                    title="Urgent"
                    aria-label="Urgent priority"
                >
                  <UrgentWarningIcon size="md" aria-hidden />
                </span>
            )}
            {hasNote && (
                <span
                    ref={notePreviewRef}
                    className="relative inline-flex shrink-0"
                    onMouseEnter={() => {
                      setIsNoteHovered(true);
                      setSuppressTransientPreview(false);
                    }}
                    onMouseLeave={() => {
                      setIsNoteHovered(false);
                      setSuppressTransientPreview(false);
                    }}
                >
                  <button
                      type="button"
                      tabIndex={0}
                      onMouseDown={preventMouseFocus}
                      onFocus={() => {
                        setIsNoteFocused(true);
                        setSuppressTransientPreview(false);
                      }}
                      onBlur={() => {
                        setIsNoteFocused(false);
                        setSuppressTransientPreview(false);
                      }}
                      onClick={handleNoteToggle}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-md outline-none transition-colors hover:bg-[var(--tt-surface-hover)] focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={{
                        color: isNotePreviewOpen ? 'var(--tt-text-muted)' : 'var(--tt-text-soft)',
                        background: isNotePreviewOpen ? 'var(--tt-surface-subtle)' : 'transparent',
                      }}
                      aria-label="Task note preview"
                      aria-expanded={isNotePreviewOpen}
                      aria-controls={notePopoverId}
                  >
                    <NoteIcon size="sm" />
                  </button>
                  {isNotePreviewOpen && (
                      <span
                          id={notePopoverId}
                          className="absolute left-0 top-full z-20 mt-2 w-64 rounded-md border p-2 text-xs leading-5 shadow-lg"
                          style={{
                            borderColor: 'var(--tt-border)',
                            background: 'var(--tt-surface-elevated)',
                            color: 'var(--tt-text)',
                            boxShadow: 'var(--tt-shadow)',
                          }}
                      >
                        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--tt-text-muted)' }}>
                          Note
                        </span>
                        <span className="block whitespace-pre-wrap break-words">{trimmedNote}</span>
                      </span>
                  )}
                </span>
            )}
            <span
                className={`min-w-0 truncate text-[15px] font-medium leading-5 ${
                    task.status === 'done' ? 'line-through' : ''
                }`}
                style={task.status === 'done' || task.status === 'archived'
                  ? { color: 'var(--tt-text-soft)' }
                  : { color: 'var(--tt-text)' }}
            >
              {task.title}
            </span>
          </div>

          {hasNote && settings.general.showNotePreviewsInTaskList && (
              <div
                  className="mt-1 truncate pr-2 text-xs leading-5"
                  style={{ color: task.status === 'archived' ? 'var(--tt-text-soft)' : 'var(--tt-text-muted)' }}
                  title={trimmedNote}
              >
                {notePreview}
              </div>
          )}
        </div>

        <TimerRingButton
            isRunning={task.timerStatus === 'running'}
            isPaused={task.timerStatus === 'paused'}
            remainingSec={task.remainingSec}
            totalSec={task.originalDurationSec}
            urgency={urgency}
            disabled={isTimerDisabled}
            onToggleAction={() => onToggleTimer(task.id)}
            sizePx={32}
            strokeWidth={3}
        />

        {/* Time pill: fixed width for alignment, neutral gray bg + dark gray text - wrapped in div for title tooltip support */}
        <div title={getFullTimeText()} className="flex-shrink-0 cursor-help">
          <Chip
              tone={timeChipTone}
              className={[
                'h-7 w-[76px] justify-center text-center',
                'tabular-nums leading-none',
              ].join(' ')}
              style={timeChipStyle}
          >
            {getDisplayTime()}
          </Chip>
        </div>

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
  );
}