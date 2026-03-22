import type { DefaultWorkspaceType, TimerMode } from './task.types';

export type ThemeMode = 'light' | 'dark' | 'system';
export type DefaultTaskView = 'active' | 'done' | 'archived' | 'all';
export type OvertimeBehavior = 'continue' | 'stop';

export type SettingsSectionId = 'general' | 'timer' | 'appearance';
export type GeneralTabId = 'behavior' | 'defaults' | 'interface';
export type TimerTabId = 'mode' | 'runtime';
export type AppearanceTabId = 'theme' | 'layout' | 'visualTweaks';

export interface GeneralSettings {
  confirmBeforeDelete: boolean;
  defaultWorkspace: DefaultWorkspaceType;
  defaultTaskViewOnStartup: DefaultTaskView;
  showUrgencyIndicator: boolean;
  showNotePreviewsInTaskList: boolean;
}

export interface TimerSettings {
  defaultMode: TimerMode;
  allowMultipleTimers: boolean;
  overtimeBehavior: OvertimeBehavior;
  showSecondsInTimer: boolean;
}

export interface AppearanceSettings {
  themeMode: ThemeMode;
  compactList: boolean;
  animationsEnabled: boolean;
  roundedCorners: number;
  ringThickness: number;
}

export interface AppSettings {
  version: 1;
  general: GeneralSettings;
  timer: TimerSettings;
  appearance: AppearanceSettings;
}

export const SETTINGS_STORAGE_KEY = 'timetag-settings';

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  general: {
    confirmBeforeDelete: true,
    defaultWorkspace: 'work',
    defaultTaskViewOnStartup: 'active',
    showUrgencyIndicator: true,
    showNotePreviewsInTaskList: true,
  },
  timer: {
    defaultMode: 'duration',
    allowMultipleTimers: true,
    overtimeBehavior: 'continue',
    showSecondsInTimer: false,
  },
  appearance: {
    themeMode: 'system',
    compactList: false,
    animationsEnabled: true,
    roundedCorners: 12,
    ringThickness: 3,
  },
};

