import type { GeneralSettings } from '@/domain/settings.types';
import { formatTimeBadge } from '@/domain/helpers';
import { supportsTimer } from '@/domain/task.mode';
import { getTaskMetadataState } from '@/domain/task.meta';
import { resolveTaskTimerBehavior } from '@/domain/timer.behavior';
import { getPomodoroDisplayMeta, isPomodoroSessionFinished } from '@/domain/timer.logic';
import { formatPomodoroCycleSummary } from '@/domain/timer.presets';
import { getUrgencyLevel } from '@/domain/task.urgency';
import type { Task, TimerDisplayMeta, UrgencyLevel } from '@/domain/task.types';
import { getTimeDisplay } from '@/shared/utils/formatTime';

export interface TaskRowViewModel {
  noteText: string;
  hasNoteText: boolean;
  notePreview: string;
  showUrgentIndicator: boolean;
  urgency: UrgencyLevel;
  showTimerButton: boolean;
  isTimerDisabled: boolean;
  shouldInterceptDoubleClickGesture: boolean;
  isDoubleClickRestartEnabled: boolean;
  isPaused: boolean;
  isRunning: boolean;
  timerDisplay: TimerDisplayMeta;
  fullTimeText: string;
}

export function getTaskRowViewModel(
  task: Task,
  options: {
    showUrgencyIndicator: boolean;
    timerBehaviorSettings: Pick<GeneralSettings, 'doubleClickRestartEnabled' | 'autoStartAfterDoubleClickRestart'>;
  },
): TaskRowViewModel {
  const metadata = getTaskMetadataState(task);
  const showUrgentIndicator = options.showUrgencyIndicator && metadata.isUrgentPriority;
  const isTimedMode = supportsTimer(task.timerMode);
  const urgency = getUrgencyLevel(task);
  const canRunTimer = isTimedMode && task.status === 'active';
  const resolvedTimerBehavior = resolveTaskTimerBehavior(task, options.timerBehaviorSettings);
  const timerDisplay = getTaskTimerDisplay(task, urgency);

  return {
    noteText: metadata.noteText,
    hasNoteText: metadata.hasNoteText,
    notePreview: metadata.hasNoteText ? metadata.noteText.split(/\r?\n/, 1)[0] : '',
    showUrgentIndicator,
    urgency,
    showTimerButton: isTimedMode,
    isTimerDisabled: !canRunTimer,
    shouldInterceptDoubleClickGesture: canRunTimer,
    isDoubleClickRestartEnabled: canRunTimer && resolvedTimerBehavior.doubleClickRestartEnabled,
    isPaused: isTimedMode && task.timerStatus === 'paused',
    isRunning: isTimedMode && task.timerStatus === 'running',
    timerDisplay,
    fullTimeText: getTaskFullTimeText(task, timerDisplay),
  };
}

function getTaskTimerDisplay(task: Task, urgency: UrgencyLevel): TimerDisplayMeta {
  if (!supportsTimer(task.timerMode)) {
    return {
      displayTime: 'no timer',
      tone: 'neutral',
      isPomodoro: false,
    };
  }

  if (task.timerMode === 'pomodoro' && task.pomodoro) {
    if (task.timerStatus === 'idle' || !task.pomodoroSession) {
      return {
        displayTime: formatPomodoroCycleSummary(task.pomodoro),
        tone: 'neutral',
        isPomodoro: true,
      };
    }

    return getPomodoroDisplayMeta(task.pomodoroSession, task.pomodoro);
  }

  if (task.timerMode === 'deadline' && task.remainingSec > 86400) {
    return {
      displayTime: getTimeDisplay(task.remainingSec).short,
      tone: urgency === 'overdue' || task.remainingSec < 0 ? 'overdue' : 'neutral',
      isPomodoro: false,
    };
  }

  return {
    displayTime: formatTimeBadge(task.remainingSec),
    tone: urgency === 'overdue' || task.remainingSec < 0 ? 'overdue' : 'neutral',
    isPomodoro: false,
  };
}

function getTaskFullTimeText(task: Task, timerDisplay: TimerDisplayMeta): string {
  if (!supportsTimer(task.timerMode)) {
    return 'Task without timer';
  }

  if (task.timerMode === 'pomodoro' && task.pomodoro) {
    if (task.timerStatus === 'idle' || !task.pomodoroSession) {
      return `${task.pomodoro.cycles} cycles: ${task.pomodoro.workDurationMin}m work, ${task.pomodoro.shortBreakMin}m short break, ${task.pomodoro.longBreakMin}m long break`;
    }

    if (isPomodoroSessionFinished(task.pomodoroSession, task.pomodoro)) {
      return `Pomodoro finished after ${task.pomodoro.cycles} work cycles and the long break.`;
    }

    switch (timerDisplay.phase) {
      case 'shortBreak':
        return `Short break after cycle ${task.pomodoroSession.cycleIndex} of ${task.pomodoro.cycles}. ${getTimeDisplay(task.pomodoroSession.remainingSec).full} remaining.`;
      case 'longBreak':
        return `Long break after ${task.pomodoro.cycles} work cycles. ${getTimeDisplay(task.pomodoroSession.remainingSec).full} remaining.`;
      case 'work':
      default:
        return `Work cycle ${task.pomodoroSession.cycleIndex} of ${task.pomodoro.cycles}. ${getTimeDisplay(task.pomodoroSession.remainingSec).full} remaining.`;
    }
  }

  return getTimeDisplay(task.remainingSec).full;
}