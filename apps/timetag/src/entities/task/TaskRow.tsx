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
} from '@/shared';
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
  const notePreviewRef = React.useRef<HTMLSpanElement | null>(null);
  const noteTriggerRef = React.useRef<HTMLButtonElement | null>(null);
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
          className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              isSelected ? 'bg-blue-50' : ''
          }`}
      >
        <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            aria-label={`Select ${task.title}`}
        />

        <button
            type="button"
            onClick={() => onToggleStatus(task.id)}
            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.status === 'done'
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-gray-400'
            } ${task.status === 'archived' ? 'opacity-50' : ''}`}
            aria-label={task.status === 'done' ? 'Mark as active' : 'Mark as done'}
            disabled={task.status === 'archived'}
        >
          {task.status === 'done' && <CheckIcon size="xs" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            {task.priority === 'urgent' && (
                <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white text-[11px] font-bold leading-none"
                    title="Urgent"
                    aria-label="Urgent priority"
                >
                  !
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
                      ref={noteTriggerRef}
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
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                        isNotePreviewOpen ? 'text-gray-600' : 'text-gray-400 hover:text-gray-600 focus:text-gray-600'
                      }`}
                      aria-label="Task note preview"
                      aria-expanded={isNotePreviewOpen}
                      aria-controls={notePopoverId}
                  >
                    <NoteIcon size="sm" />
                  </button>
                  {isNotePreviewOpen && (
                      <span
                          id={notePopoverId}
                          className="absolute left-0 top-full z-20 mt-2 w-64 rounded-md border border-gray-200 bg-white p-2 text-xs leading-5 text-gray-700 shadow-lg"
                      >
                        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                          Note
                        </span>
                        <span className="block whitespace-pre-wrap break-words">{trimmedNote}</span>
                      </span>
                  )}
                </span>
            )}
            <span
                className={`truncate ${
                    task.status === 'done'
                        ? 'text-gray-400 line-through'
                        : task.status === 'archived'
                            ? 'text-gray-400'
                            : 'text-gray-900'
                }`}
            >
              {task.title}
            </span>
          </div>

          {hasNote && (
              <div
                  className={`mt-0.5 truncate pr-2 text-xs ${
                      task.status === 'archived'
                          ? 'text-gray-400'
                          : 'text-gray-500'
                  }`}
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
            onClick={() => onToggleTimer(task.id)}
            sizePx={32}
            strokeWidth={3}
        />

        {/* Time pill: fixed width for alignment, neutral gray bg + dark gray text - wrapped in div for title tooltip support */}
        <div title={getFullTimeText()} className="flex-shrink-0 cursor-help">
          <Chip
              className={[
                'w-[72px] justify-center text-center',  // Fixed width + center alignment
                'h-7 px-3',
                'tabular-nums leading-none',
                // light
                'border-gray-200 bg-gray-100 text-gray-700',
                // dark (чтобы текст не исчезал)
                'dark:border-white/10 dark:bg-white/10 dark:text-slate-500',
              ].join(' ')}
          >
            {getDisplayTime()}
          </Chip>
        </div>

        <Dropdown
            trigger={
              <span className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
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