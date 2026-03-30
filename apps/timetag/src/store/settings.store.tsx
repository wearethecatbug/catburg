'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  clampDurationSec,
  filterDurationPresetIds,
  getVisibleDurationPresetById,
} from '@/domain/duration';
import { isDurationPresetId } from '@/domain/duration';
import {
  clampDeadlineOffsetSec,
  filterDeadlinePresetIds,
  filterPomodoroPresetIds,
  getVisibleDeadlinePresetById,
  getVisiblePomodoroPresetById,
} from '@/domain/timer.presets';
import { isAssignableWorkspaceType } from '@/domain/workspace';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  OvertimeBehavior,
  SETTINGS_STORAGE_KEY,
  type AppearanceSettings,
  type DefaultTaskView,
  type GeneralSettings,
  type TimerSettings,
} from '@/domain/settings.types';
import { isThemeMode, normalizeCustomThemeSettings } from '@/domain/theme';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';

interface SettingsContextValue {
  settings: AppSettings;
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  updateTimer: (patch: Partial<TimerSettings>) => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  replaceSettings: (next: AppSettings) => void;
  resetSettings: () => void;
  isHydrated: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDefaultTaskView(value: unknown): value is DefaultTaskView {
  return value === 'active' || value === 'all';
}

function isOvertimeBehavior(value: unknown): value is OvertimeBehavior {
  return value === 'continue' || value === 'stop';
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;

  const general = isRecord(raw.general) ? raw.general : {};
  const timer = isRecord(raw.timer) ? raw.timer : {};
  const appearance = isRecord(raw.appearance) ? raw.appearance : {};
  const customTheme = normalizeCustomThemeSettings(appearance.customTheme);
  const legacyDefaultTimerPreset = isDurationPresetId(general.defaultTimerPreset)
    ? general.defaultTimerPreset
    : undefined;
  const durationDefaults = isRecord(timer.durationDefaults) ? timer.durationDefaults : {};
  const pomodoroDefaults = isRecord(timer.pomodoroDefaults) ? timer.pomodoroDefaults : {};
  const deadlineDefaults = isRecord(timer.deadlineDefaults) ? timer.deadlineDefaults : {};
  const hiddenDurationPresetIds = filterDurationPresetIds(timer.hiddenDurationPresetIds);
  const hiddenPomodoroPresetIds = filterPomodoroPresetIds(timer.hiddenPomodoroPresetIds);
  const hiddenDeadlinePresetIds = filterDeadlinePresetIds(timer.hiddenDeadlinePresetIds);
  const resolvedDurationPreset = getVisibleDurationPresetById(
    durationDefaults.presetId ?? legacyDefaultTimerPreset,
    hiddenDurationPresetIds,
  );
  const resolvedPomodoroPreset = getVisiblePomodoroPresetById(
    pomodoroDefaults.presetId,
    hiddenPomodoroPresetIds,
  );
  const resolvedDeadlinePreset = getVisibleDeadlinePresetById(
    deadlineDefaults.presetId,
    hiddenDeadlinePresetIds,
  );

  return {
    version: 3,
    general: {
      autoStartTimerWhenTaskCreated:
        typeof general.autoStartTimerWhenTaskCreated === 'boolean'
          ? general.autoStartTimerWhenTaskCreated
          : DEFAULT_SETTINGS.general.autoStartTimerWhenTaskCreated,
      autoPauseOtherTimers:
        typeof general.autoPauseOtherTimers === 'boolean'
          ? general.autoPauseOtherTimers
          : DEFAULT_SETTINGS.general.autoPauseOtherTimers,
      confirmBeforeDelete:
        typeof general.confirmBeforeDelete === 'boolean'
          ? general.confirmBeforeDelete
          : DEFAULT_SETTINGS.general.confirmBeforeDelete,
      defaultWorkspace: isAssignableWorkspaceType(general.defaultWorkspace)
        ? general.defaultWorkspace
        : DEFAULT_SETTINGS.general.defaultWorkspace,
      defaultTaskView: isDefaultTaskView(general.defaultTaskView)
        ? general.defaultTaskView
        : isDefaultTaskView(general.defaultTaskViewOnStartup)
          ? general.defaultTaskViewOnStartup
          : DEFAULT_SETTINGS.general.defaultTaskView,
      showCompletedTasks:
        typeof general.showCompletedTasks === 'boolean'
          ? general.showCompletedTasks
          : DEFAULT_SETTINGS.general.showCompletedTasks,
      showUrgencyIndicator:
        typeof general.showUrgencyIndicator === 'boolean'
          ? general.showUrgencyIndicator
          : DEFAULT_SETTINGS.general.showUrgencyIndicator,
      showNotePreviewsInTaskList:
        typeof general.showNotePreviewsInTaskList === 'boolean'
          ? general.showNotePreviewsInTaskList
          : DEFAULT_SETTINGS.general.showNotePreviewsInTaskList,
    },
    timer: {
      defaultMode:
        timer.defaultMode === 'duration' || timer.defaultMode === 'pomodoro' || timer.defaultMode === 'deadline'
          ? timer.defaultMode
          : DEFAULT_SETTINGS.timer.defaultMode,
      allowMultipleTimers:
        typeof timer.allowMultipleTimers === 'boolean'
          ? timer.allowMultipleTimers
          : DEFAULT_SETTINGS.timer.allowMultipleTimers,
      overtimeBehavior: isOvertimeBehavior(timer.overtimeBehavior)
        ? timer.overtimeBehavior
        : DEFAULT_SETTINGS.timer.overtimeBehavior,
      showSecondsInTimer:
        typeof timer.showSecondsInTimer === 'boolean'
          ? timer.showSecondsInTimer
          : DEFAULT_SETTINGS.timer.showSecondsInTimer,
      durationDefaults: {
        presetId: resolvedDurationPreset.id,
        durationSec: clampDurationSec(
          typeof durationDefaults.durationSec === 'number'
            ? durationDefaults.durationSec
            : resolvedDurationPreset.durationSec,
        ),
      },
      pomodoroDefaults: {
        presetId: resolvedPomodoroPreset.id,
        cycles: clampNumber(pomodoroDefaults.cycles, resolvedPomodoroPreset.cycles, 1, 12),
        workDurationMin: clampNumber(
          pomodoroDefaults.workDurationMin,
          resolvedPomodoroPreset.workDurationMin,
          1,
          240,
        ),
        shortBreakMin: clampNumber(
          pomodoroDefaults.shortBreakMin,
          resolvedPomodoroPreset.shortBreakMin,
          1,
          120,
        ),
        longBreakMin: clampNumber(
          pomodoroDefaults.longBreakMin,
          resolvedPomodoroPreset.longBreakMin,
          1,
          180,
        ),
      },
      deadlineDefaults: {
        presetId: resolvedDeadlinePreset.id,
        offsetSec: clampDeadlineOffsetSec(
          typeof deadlineDefaults.offsetSec === 'number'
            ? deadlineDefaults.offsetSec
            : typeof deadlineDefaults.days === 'number'
              ? deadlineDefaults.days * 86400
              : resolvedDeadlinePreset.offsetSec,
        ),
      },
      hiddenDurationPresetIds,
      hiddenPomodoroPresetIds,
      hiddenDeadlinePresetIds,
    },
    appearance: {
      themeMode: isThemeMode(appearance.themeMode)
        ? appearance.themeMode
        : DEFAULT_SETTINGS.appearance.themeMode,
      customTheme,
      compactList:
        typeof appearance.compactList === 'boolean'
          ? appearance.compactList
          : DEFAULT_SETTINGS.appearance.compactList,
      animationsEnabled:
        typeof appearance.animationsEnabled === 'boolean'
          ? appearance.animationsEnabled
          : DEFAULT_SETTINGS.appearance.animationsEnabled,
      roundedCorners: clampNumber(
        appearance.roundedCorners,
        DEFAULT_SETTINGS.appearance.roundedCorners,
        0,
        24,
      ),
      ringThickness: clampNumber(
        appearance.ringThickness,
        DEFAULT_SETTINGS.appearance.ringThickness,
        1,
        6,
      ),
    },
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [storedSettings, setStoredSettings, isHydrated] = useLocalStorage<AppSettings>(
    SETTINGS_STORAGE_KEY,
    DEFAULT_SETTINGS,
  );

  const settings = useMemo(() => normalizeSettings(storedSettings), [storedSettings]);

  const updateGeneral = useCallback((patch: Partial<GeneralSettings>) => {
    setStoredSettings((prev) => ({
      ...normalizeSettings(prev),
      general: { ...normalizeSettings(prev).general, ...patch },
    }));
  }, [setStoredSettings]);

  const updateTimer = useCallback((patch: Partial<TimerSettings>) => {
    setStoredSettings((prev) => ({
      ...normalizeSettings(prev),
      timer: { ...normalizeSettings(prev).timer, ...patch },
    }));
  }, [setStoredSettings]);

  const updateAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setStoredSettings((prev) => ({
      ...normalizeSettings(prev),
      appearance: { ...normalizeSettings(prev).appearance, ...patch },
    }));
  }, [setStoredSettings]);

  const replaceSettings = useCallback((next: AppSettings) => {
    setStoredSettings(normalizeSettings(next));
  }, [setStoredSettings]);

  const resetSettings = useCallback(() => {
    setStoredSettings(DEFAULT_SETTINGS);
  }, [setStoredSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateGeneral,
      updateTimer,
      updateAppearance,
      replaceSettings,
      resetSettings,
      isHydrated,
    }),
    [settings, updateGeneral, updateTimer, updateAppearance, replaceSettings, resetSettings, isHydrated],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

