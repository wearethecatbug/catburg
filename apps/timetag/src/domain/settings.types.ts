import type { DurationPresetId } from './duration';
import type { DeadlinePresetId, PomodoroPresetId } from './timer.presets';
import type { AssignableWorkspaceType, TimerMode } from './task.types';
import {
  DEFAULT_CUSTOM_THEME_SETTINGS,
  type CustomThemeSettings,
  type ThemeMode,
} from './theme';

export type { CustomThemeOverrides, CustomThemePresetId, CustomThemeSettings, ThemeMode } from './theme';

export type DefaultTaskView = 'active' | 'all';
export type OvertimeBehavior = 'continue' | 'stop';

export type SettingsSectionId = 'general' | 'timer' | 'appearance';
export type GeneralTabId = 'behavior' | 'defaults' | 'interface';
export type TimerTabId = 'mode' | 'presets' | 'runtime';
export type AppearanceTabId = 'theme' | 'layout' | 'visualTweaks';

export interface GeneralSettings {
  autoStartTimerWhenTaskCreated: boolean;
  autoPauseOtherTimers: boolean;
  confirmBeforeDelete: boolean;
  defaultWorkspace: AssignableWorkspaceType;
  defaultTaskView: DefaultTaskView;
  showCompletedTasks: boolean;
  showUrgencyIndicator: boolean;
  showNotePreviewsInTaskList: boolean;
}

export interface DurationDefaults {
  presetId: DurationPresetId;
  durationSec: number;
}

export interface PomodoroDefaults {
  presetId: PomodoroPresetId;
  cycles: number;
  workDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
}

export interface DeadlineDefaults {
  presetId: DeadlinePresetId;
  offsetSec: number;
}

export interface TimerSettings {
  defaultMode: TimerMode;
  allowMultipleTimers: boolean;
  overtimeBehavior: OvertimeBehavior;
  showSecondsInTimer: boolean;
  durationDefaults: DurationDefaults;
  pomodoroDefaults: PomodoroDefaults;
  deadlineDefaults: DeadlineDefaults;
  hiddenDurationPresetIds: DurationPresetId[];
  hiddenPomodoroPresetIds: PomodoroPresetId[];
  hiddenDeadlinePresetIds: DeadlinePresetId[];
}

export interface AppearanceSettings {
  themeMode: ThemeMode;
  customTheme: CustomThemeSettings;
  compactList: boolean;
  animationsEnabled: boolean;
  roundedCorners: number;
  ringThickness: number;
}

export interface AppSettings {
  version: 3;
  general: GeneralSettings;
  timer: TimerSettings;
  appearance: AppearanceSettings;
}

export const SETTINGS_STORAGE_KEY = 'timetag-settings';

export const DEFAULT_SETTINGS: AppSettings = {
  version: 3,
  general: {
    autoStartTimerWhenTaskCreated: false,
    autoPauseOtherTimers: false,
    confirmBeforeDelete: true,
    defaultWorkspace: 'work',
    defaultTaskView: 'active',
    showCompletedTasks: true,
    showUrgencyIndicator: true,
    showNotePreviewsInTaskList: true,
  },
  timer: {
    defaultMode: 'duration',
    allowMultipleTimers: true,
    overtimeBehavior: 'continue',
    showSecondsInTimer: false,
    durationDefaults: {
      presetId: '25',
      durationSec: 25 * 60,
    },
    pomodoroDefaults: {
      presetId: 'classic',
      cycles: 1,
      workDurationMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
    },
    deadlineDefaults: {
      presetId: '1d',
      // @eslint-disable-next-line no-magic-numbers
      offsetSec: 1 * 86400,
    },
    hiddenDurationPresetIds: [],
    hiddenPomodoroPresetIds: [],
    hiddenDeadlinePresetIds: [],
  },
  appearance: {
    themeMode: 'light',
    customTheme: DEFAULT_CUSTOM_THEME_SETTINGS,
    compactList: false,
    animationsEnabled: true,
    roundedCorners: 12,
    ringThickness: 3,
  },
};

