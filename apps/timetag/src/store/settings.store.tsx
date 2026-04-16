'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppearanceSettings,
  type GeneralSettings,
  type TimerSettings,
} from '@/domain/settings.types';
import { normalizeSettings } from '@/domain/settings.normalize';
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

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [storedSettings, setStoredSettings, isHydrated] = useLocalStorage<AppSettings>(
    SETTINGS_STORAGE_KEY,
    DEFAULT_SETTINGS,
  );

  const settings = useMemo(() => normalizeSettings(storedSettings), [storedSettings]);

  const updateGeneral = useCallback((patch: Partial<GeneralSettings>) => {
    setStoredSettings((prev) => {
      const normalizedPrev = normalizeSettings(prev);
      return {
        ...normalizedPrev,
        general: { ...normalizedPrev.general, ...patch },
      };
    });
  }, [setStoredSettings]);

  const updateTimer = useCallback((patch: Partial<TimerSettings>) => {
    setStoredSettings((prev) => {
      const normalizedPrev = normalizeSettings(prev);
      return {
        ...normalizedPrev,
        timer: { ...normalizedPrev.timer, ...patch },
      };
    });
  }, [setStoredSettings]);

  const updateAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setStoredSettings((prev) => {
      const normalizedPrev = normalizeSettings(prev);
      return {
        ...normalizedPrev,
        appearance: { ...normalizedPrev.appearance, ...patch },
      };
    });
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

