import type { GeneralSettings } from './settings.types';
import type { Task, TimerBehaviorOverride } from './task.types';

export interface ResolvedTaskTimerBehavior {
  doubleClickRestartEnabled: boolean;
  autoStartAfterDoubleClickRestart: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeTimerBehaviorOverride(raw: unknown): TimerBehaviorOverride | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const normalized: TimerBehaviorOverride = {};

  if (typeof raw.doubleClickRestartEnabled === 'boolean') {
    normalized.doubleClickRestartEnabled = raw.doubleClickRestartEnabled;
  }

  if (typeof raw.autoStartAfterDoubleClickRestart === 'boolean') {
    normalized.autoStartAfterDoubleClickRestart = raw.autoStartAfterDoubleClickRestart;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function resolveTimerBehaviorSettings(
  override: TimerBehaviorOverride | undefined,
  generalSettings: Pick<GeneralSettings, 'doubleClickRestartEnabled' | 'autoStartAfterDoubleClickRestart'>,
): ResolvedTaskTimerBehavior {
  const doubleClickRestartEnabled = override?.doubleClickRestartEnabled ?? generalSettings.doubleClickRestartEnabled;
  const autoStartAfterDoubleClickRestart = doubleClickRestartEnabled
    ? (override?.autoStartAfterDoubleClickRestart ?? generalSettings.autoStartAfterDoubleClickRestart)
    : false;

  return {
    doubleClickRestartEnabled,
    autoStartAfterDoubleClickRestart,
  };
}

export function resolveTaskTimerBehavior(
  task: Pick<Task, 'timerBehaviorOverride'>,
  generalSettings: Pick<GeneralSettings, 'doubleClickRestartEnabled' | 'autoStartAfterDoubleClickRestart'>,
): ResolvedTaskTimerBehavior {
  return resolveTimerBehaviorSettings(task.timerBehaviorOverride, generalSettings);
}

export function createTimerBehaviorOverride(
  behavior: ResolvedTaskTimerBehavior,
  generalSettings: Pick<GeneralSettings, 'doubleClickRestartEnabled' | 'autoStartAfterDoubleClickRestart'>,
): TimerBehaviorOverride | undefined {
  const override: TimerBehaviorOverride = {};

  if (behavior.doubleClickRestartEnabled !== generalSettings.doubleClickRestartEnabled) {
    override.doubleClickRestartEnabled = behavior.doubleClickRestartEnabled;
  }

  if (behavior.autoStartAfterDoubleClickRestart !== generalSettings.autoStartAfterDoubleClickRestart) {
    override.autoStartAfterDoubleClickRestart = behavior.autoStartAfterDoubleClickRestart;
  }

  return Object.keys(override).length > 0 ? override : undefined;
}

