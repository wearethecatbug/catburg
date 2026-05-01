import type { GeneralSettings } from '@/domain/settings.types';
import {
  formatDurationValue,
  getDurationPresetById,
  type DurationPresetId,
  type DurationUnit,
} from '@/domain/duration';
import {
  TASK_NOTE_MAX_LENGTH,
  type AssignableWorkspaceType,
  type CreateTaskInput,
  type TaskPriority,
  type TimerMode,
  type WorkspaceType,
} from '@/domain/task.types';
import {
  resolveTaskWorkspace,
  type WorkspaceTab,
} from '@/domain/workspace';
import { supportsTimer } from '@/domain/task.mode';
import { createTimerBehaviorOverride } from '@/domain/timer.behavior';

export const CUSTOM_DURATION_PRESET_ID = '__custom-duration-default__';
export const CUSTOM_POMODORO_PRESET_ID = '__custom-pomodoro-default__';
export const CUSTOM_DEADLINE_PRESET_ID = '__custom-deadline-default__';

export function getDurationUnitFromSec(valueSec: number): DurationUnit {
  if (valueSec % 86400 === 0) return 'd';
  if (valueSec % 3600 === 0) return 'h';
  return 'min';
}

export function formatCompactDurationLabel(durationSec: number): string {
  const unit = getDurationUnitFromSec(durationSec);
  const unitLabel = unit === 'min' ? 'm' : unit;
  return `${formatDurationValue(durationSec, unit)}${unitLabel}`;
}

export function getApproxDeadlineOffsetSec(localValue: string, nowMs: number = Date.now()): number | null {
  if (!localValue) return null;

  const target = new Date(`${localValue}:00`);
  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - nowMs;
  return Math.max(60, Math.round(diffMs / 60000) * 60);
}

export function buildDeadlineLocalValue(offsetSec: number, now: Date = new Date()): string {
  const next = new Date(now);
  next.setSeconds(next.getSeconds() + offsetSec);

  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  const hours = String(next.getHours()).padStart(2, '0');
  const minutes = String(next.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getDurationPresetLabel(durationSec: number, presetId: DurationPresetId): string | undefined {
  const preset = getDurationPresetById(presetId);
  return preset.durationSec === durationSec ? preset.label : undefined;
}

interface BuildCreateTaskInputArgs {
  title: string;
  note: string;
  defaultWorkspace?: AssignableWorkspaceType;
  workspaceOverride?: AssignableWorkspaceType;
  currentWorkspace: WorkspaceType;
  lastConcreteWorkspace?: AssignableWorkspaceType;
  workspaces: WorkspaceTab[];
  fallbackWorkspace: AssignableWorkspaceType;
  priority: TaskPriority;
  timerMode: TimerMode;
  durationSec: number;
  deadlineDate: string;
  autoEnabled: boolean;
  playEnabled: boolean;
  autoResetEnabled: boolean;
  overdueEnabled: boolean;
  doubleClickRestartEnabled: boolean;
  autoStartAfterDoubleClickRestart: boolean;
  globalTimerBehaviorSettings: Pick<GeneralSettings, 'doubleClickRestartEnabled' | 'autoStartAfterDoubleClickRestart'>;
  pomoCycles: number;
  pomoWorkMin: number;
  pomoShortBreakMin: number;
  pomoLongBreakMin: number;
}

export function buildCreateTaskInput({
  title,
  note,
  defaultWorkspace,
  workspaceOverride,
  currentWorkspace,
  lastConcreteWorkspace,
  workspaces,
  fallbackWorkspace,
  priority,
  timerMode,
  durationSec,
  deadlineDate,
  autoEnabled,
  playEnabled,
  autoResetEnabled,
  overdueEnabled,
  doubleClickRestartEnabled,
  autoStartAfterDoubleClickRestart,
  globalTimerBehaviorSettings,
  pomoCycles,
  pomoWorkMin,
  pomoShortBreakMin,
  pomoLongBreakMin,
}: BuildCreateTaskInputArgs): CreateTaskInput {
  const trimmedTitle = title.trim();
  const normalizedNote = note.trim().slice(0, TASK_NOTE_MAX_LENGTH) || undefined;
  const workspace = resolveTaskWorkspace({
    workspaces,
    explicitWorkspace: workspaceOverride,
    currentWorkspace,
    lastConcreteWorkspace,
    fallbackWorkspace,
    defaultWorkspace,
  });
  const nextDurationSec =
    !supportsTimer(timerMode) || timerMode === 'deadline'
      ? undefined
      : timerMode === 'pomodoro'
        ? Math.max(1, Math.floor(Number(pomoWorkMin))) * 60
        : durationSec;

  let targetAt: string | undefined;
  if (timerMode === 'deadline' && deadlineDate) {
    const localDate = new Date(`${deadlineDate}:00`);
    if (!Number.isNaN(localDate.getTime())) {
      targetAt = localDate.toISOString();
    }
  }

  const taskData: CreateTaskInput = {
    title: trimmedTitle,
    note: normalizedNote,
    workspace,
    priority,
    timerMode,
    durationSec: nextDurationSec,
    targetAt,
    timerControls: supportsTimer(timerMode)
      ? {
          autoStart: autoEnabled,
          autoPlay: playEnabled,
          autoReset: autoResetEnabled,
          allowOverdue: overdueEnabled,
        }
      : undefined,
    timerBehaviorOverride: supportsTimer(timerMode)
      ? createTimerBehaviorOverride(
          {
            doubleClickRestartEnabled,
            autoStartAfterDoubleClickRestart,
          },
          globalTimerBehaviorSettings,
        )
      : undefined,
  };

  if (timerMode === 'pomodoro') {
    taskData.pomodoro = {
      cycles: Math.max(1, Math.floor(Number(pomoCycles))),
      workDurationMin: Math.max(1, Math.floor(Number(pomoWorkMin))),
      shortBreakMin: Math.max(1, Math.floor(Number(pomoShortBreakMin))),
      longBreakMin: Math.max(1, Math.floor(Number(pomoLongBreakMin))),
      autoStart: autoEnabled,
      autoPlay: playEnabled,
    };
  }

  return taskData;
}

