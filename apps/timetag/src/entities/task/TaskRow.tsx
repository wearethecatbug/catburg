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
  const isTimerDisabled = task.status !== 'active';
  
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

        <span
            className={`flex-1 text-sm ${
                task.status === 'done'
                    ? 'text-gray-400 line-through'
                    : task.status === 'archived'
                        ? 'text-gray-400'
                        : 'text-gray-900'
            }`}
        >
        {task.title}
      </span>

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