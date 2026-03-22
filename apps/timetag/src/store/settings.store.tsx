'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  OvertimeBehavior,
  SETTINGS_STORAGE_KEY,
  ThemeMode,
  type AppearanceSettings,
  type DefaultTaskView,
  type GeneralSettings,
  type TimerSettings,
} from '@/domain/settings.types';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';

interface SettingsContextValue {
  settings: AppSettings;
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  updateTimer: (patch: Partial<TimerSettings>) => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  resetSettings: () => void;
  isHydrated: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDefaultTaskView(value: unknown): value is DefaultTaskView {
  return value === 'active' || value === 'done' || value === 'archived' || value === 'all';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
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

  return {
    version: 1,
    general: {
      confirmBeforeDelete:
        typeof general.confirmBeforeDelete === 'boolean'
          ? general.confirmBeforeDelete
          : DEFAULT_SETTINGS.general.confirmBeforeDelete,
      defaultWorkspace:
        general.defaultWorkspace === 'work' || general.defaultWorkspace === 'home'
          ? general.defaultWorkspace
          : DEFAULT_SETTINGS.general.defaultWorkspace,
      defaultTaskViewOnStartup: isDefaultTaskView(general.defaultTaskViewOnStartup)
        ? general.defaultTaskViewOnStartup
        : DEFAULT_SETTINGS.general.defaultTaskViewOnStartup,
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
    },
    appearance: {
      themeMode: isThemeMode(appearance.themeMode)
        ? appearance.themeMode
        : DEFAULT_SETTINGS.appearance.themeMode,
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

  const resetSettings = useCallback(() => {
    setStoredSettings(DEFAULT_SETTINGS);
  }, [setStoredSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateGeneral,
      updateTimer,
      updateAppearance,
      resetSettings,
      isHydrated,
    }),
    [settings, updateGeneral, updateTimer, updateAppearance, resetSettings, isHydrated],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

