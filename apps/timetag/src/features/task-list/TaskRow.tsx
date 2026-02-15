'use client';

import React from 'react';
import { Task } from '@/types';
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
} from '@/components';
import { useTasks } from '@/context';
import { formatTimeBadge, getUrgencyLevel } from '@/utils';

interface TaskRowProps {
  task: Task;
  onDelete: (id: string) => void;
}

export function TaskRow({ task, onDelete }: TaskRowProps) {
  const {
    toggleTimer,
    resetTimer,
    updateTask,
    toggleSelect,
    state,
  } = useTasks();

  const isSelected = state.selectedIds.has(task.id);
  const urgency = getUrgencyLevel(task);

  const handleToggleStatus = () => {
    if (task.status === 'active') {
      updateTask(task.id, { status: 'done', timerStatus: 'paused' });
    } else if (task.status === 'done') {
      updateTask(task.id, { status: 'active' });
    }
  };

  const handleArchive = () => {
    updateTask(task.id, { status: 'archived', timerStatus: 'paused' });
  };

  const handleUnarchive = () => {
    updateTask(task.id, { status: 'active' });
  };

  const getTimeBadgeText = (): string => {
    if (task.timerStatus === 'paused') {
      return 'Paused';
    }
    if (task.timerStatus === 'expired' || task.remainingSec < 0) {
      return formatTimeBadge(task.remainingSec);
    }
    return formatTimeBadge(task.remainingSec);
  };

  const isTimerDisabled = task.status !== 'active';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50' : ''
      }`}
    >
      {/* Selection Checkbox */}
      <Checkbox
        checked={isSelected}
        onChange={() => toggleSelect(task.id)}
        aria-label={`Select ${task.title}`}
      />

      {/* Done Checkbox */}
      <button
        type="button"
        onClick={handleToggleStatus}
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
        onClick={() => toggleTimer(task.id)}
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
        {task.timerStatus === 'running' ? (
          <PauseIcon size="md" />
        ) : (
          <PlayIcon size="md" />
        )}
      </button>

      {/* Time Badge */}
      <Badge urgency={urgency} className="min-w-[60px] justify-center">
        {getTimeBadgeText()}
      </Badge>

      {/* Row Menu */}
      <Dropdown
        trigger={
          <span className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <MoreVerticalIcon size="sm" aria-label="Task options" />
          </span>
        }
        align="right"
      >
        <DropdownItem onClick={() => resetTimer(task.id)}>
          Reset timer
        </DropdownItem>
        <DropdownItem onClick={handleToggleStatus}>
          {task.status === 'done' ? 'Mark as active' : 'Mark as done'}
        </DropdownItem>
        {task.status !== 'archived' ? (
          <DropdownItem onClick={handleArchive}>Archive</DropdownItem>
        ) : (
          <DropdownItem onClick={handleUnarchive}>Unarchive</DropdownItem>
        )}
        <DropdownDivider />
        <DropdownItem onClick={() => onDelete(task.id)} danger>
          Delete
        </DropdownItem>
      </Dropdown>
    </div>
  );
}
