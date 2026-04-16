'use client';

import React from 'react';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AppearanceSettings,
  type GeneralSettings,
  type TimerSettings,
} from '@/domain/settings.types';
import { useSettings } from '@/store';

interface UseSettingsDraftOptions {
  isOpen: boolean;
  onClose: () => void;
}

function cloneSettings(value: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(value)) as AppSettings;
}

export function useSettingsDraft({ isOpen, onClose }: UseSettingsDraftOptions) {
  const { settings, replaceSettings } = useSettings();
  const [draftSettings, setDraftSettings] = React.useState<AppSettings>(settings);

  React.useEffect(() => {
    if (!isOpen) return;
    setDraftSettings(cloneSettings(settings));
  }, [isOpen, settings]);

  const handleCancel = React.useCallback(() => {
    setDraftSettings(cloneSettings(settings));
    onClose();
  }, [onClose, settings]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleCancel, isOpen]);

  const updateGeneral = React.useCallback((patch: Partial<GeneralSettings>) => {
    setDraftSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...patch },
    }));
  }, []);

  const updateTimer = React.useCallback((patch: Partial<TimerSettings>) => {
    setDraftSettings((prev) => ({
      ...prev,
      timer: { ...prev.timer, ...patch },
    }));
  }, []);

  const updateAppearance = React.useCallback((patch: Partial<AppearanceSettings>) => {
    setDraftSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...patch },
    }));
  }, []);

  const handleSave = React.useCallback(() => {
    replaceSettings(draftSettings);
    onClose();
  }, [draftSettings, onClose, replaceSettings]);

  const handleResetDraft = React.useCallback(() => {
    setDraftSettings(cloneSettings(DEFAULT_SETTINGS));
  }, []);

  const isDirty = React.useMemo(
    () => JSON.stringify(draftSettings) !== JSON.stringify(settings),
    [draftSettings, settings],
  );

  return {
    draftSettings,
    updateGeneral,
    updateTimer,
    updateAppearance,
    handleCancel,
    handleSave,
    handleResetDraft,
    isDirty,
  };
}

