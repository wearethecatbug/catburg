import type { Task, UrgencyLevel } from '@/domain/task.types';
import { formatTimeBadge } from '@/domain/helpers';
import { getUrgencyLevel } from '@/domain/task.urgency';
import { getTimeDisplay } from '@/shared/utils/formatTime';

export interface TaskRowViewModel {
  trimmedNote: string;
  hasNote: boolean;
  notePreview: string;
  showUrgentIndicator: boolean;
  showMetaCluster: boolean;
  urgency: UrgencyLevel;
  isTimerDisabled: boolean;
  isPaused: boolean;
  isRunning: boolean;
  displayTime: string;
  fullTimeText: string;
}

export function getTaskRowViewModel(
  task: Task,
  options: { showUrgencyIndicator: boolean },
): TaskRowViewModel {
  const trimmedNote = task.note?.trim() ?? '';
  const hasNote = Boolean(trimmedNote);
  const showUrgentIndicator = options.showUrgencyIndicator && task.priority === 'urgent';
  const urgency = getUrgencyLevel(task);

  return {
    trimmedNote,
    hasNote,
    notePreview: hasNote ? trimmedNote.split(/\r?\n/, 1)[0] : '',
    showUrgentIndicator,
    showMetaCluster: showUrgentIndicator || hasNote,
    urgency,
    isTimerDisabled: task.status !== 'active',
    isPaused: task.timerStatus === 'paused',
    isRunning: task.timerStatus === 'running',
    displayTime: getTaskDisplayTime(task),
    fullTimeText: getTaskFullTimeText(task),
  };
}

function getTaskDisplayTime(task: Task): string {
  if (task.timerMode === 'pomodoro' && task.pomodoro) {
    return `${task.pomodoro.cycles}×${task.pomodoro.workDurationMin}m`;
  }

  if (task.timerMode === 'deadline' && task.remainingSec > 86400) {
    return getTimeDisplay(task.remainingSec).short;
  }

  return formatTimeBadge(task.remainingSec);
}

function getTaskFullTimeText(task: Task): string {
  if (task.timerMode === 'pomodoro' && task.pomodoro) {
    return `${task.pomodoro.cycles} cycles: ${task.pomodoro.workDurationMin}m work, ${task.pomodoro.shortBreakMin}m break, ${task.pomodoro.longBreakMin}m long break`;
  }

  return getTimeDisplay(task.remainingSec).full;
}

