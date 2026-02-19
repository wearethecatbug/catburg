'use client';

import React from 'react';
import type { Task, UrgencyLevel } from '@/domain/task.types';
import {
  Badge,
  Dropdown,
  DropdownItem,
  DropdownDivider,
  Checkbox,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  MoreVerticalIcon,
} from '@/shared';
import { getUrgencyLevel } from '@/domain/task.urgency';
import { formatTimeBadge } from '@/domain/helpers';

// ============================================================================
// Props — all callbacks injected, no store access
// ============================================================================

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
  const urgency: UrgencyLevel = getUrgencyLevel(task);
  const isTimerDisabled = task.status !== 'active';

  const getTimeBadgeText = (): string => {
    if (task.timerStatus === 'paused') return 'Paused';
    return formatTimeBadge(task.remainingSec);
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50' : ''
      }`}
    >
      {/* Selection Checkbox */}
      <Checkbox
        checked={isSelected}
        onChange={() => onToggleSelect(task.id)}
        aria-label={`Select ${task.title}`}
      />

      {/* Done Checkbox */}
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

      {/* Title */}
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

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={() => onToggleTimer(task.id)}
        disabled={isTimerDisabled}
        className={`p-1.5 rounded-lg transition-colors ${
          isTimerDisabled
            ? 'text-gray-300 cursor-not-allowed'
            : task.timerStatus === 'running'
              ? 'text-orange-500 hover:bg-orange-50'
              : 'text-green-600 hover:bg-green-50'
        }`}
        aria-label={task.timerStatus === 'running' ? 'Pause timer' : 'Start timer'}
      >
        {task.timerStatus === 'running' ? <PauseIcon size="md" /> : <PlayIcon size="md" />}
      </button>

      {/* Time Badge */}
      <Badge urgency={urgency} className="min-w-[60px] justify-center">
        {getTimeBadgeText()}
      </Badge>

      {/* Row Menu (dynamic by status) */}
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

