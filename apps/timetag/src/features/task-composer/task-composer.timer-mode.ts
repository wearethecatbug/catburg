import type { TimerMode } from '@/domain/task.types';

export const TASK_COMPOSER_TIMER_MODE_OPTIONS: Array<{ id: TimerMode; label: string }> = [
  { id: 'duration', label: 'Duration' },
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'note', label: 'Note' },
  { id: 'deadline', label: 'Deadline' },
];

export function getTaskComposerTimerModeLabel(timerMode: TimerMode) {
  return TASK_COMPOSER_TIMER_MODE_OPTIONS.find((option) => option.id === timerMode)?.label ?? 'Note';
}

