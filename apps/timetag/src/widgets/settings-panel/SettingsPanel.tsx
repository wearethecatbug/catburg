'use client';

import React from 'react';
import type {
  AppSettings,
  AppearanceTabId,
  AppearanceSettings,
  GeneralSettings,
  GeneralTabId,
  SettingsSectionId,
  TimerSettings,
  TimerTabId,
} from '@/domain/settings.types';
import { DEFAULT_SETTINGS } from '@/domain/settings.types';
import { useSettings } from '@/store';
import {
  AppearanceSettingsSection,
  GeneralSettingsSection,
  SettingsSidebar,
  SettingsTabs,
  TimerSettingsSection,
} from '@/features/settings';
import { CloseIcon } from '@/shared';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const GENERAL_TABS: Array<{ id: GeneralTabId; label: string }> = [
  { id: 'behavior', label: 'Behavior' },
  { id: 'defaults', label: 'Defaults' },
  { id: 'interface', label: 'Interface' },
];

const TIMER_TABS: Array<{ id: TimerTabId; label: string }> = [
  { id: 'mode', label: 'Mode' },
  { id: 'presets', label: 'Presets' },
  { id: 'runtime', label: 'Runtime' },
];

const APPEARANCE_TABS: Array<{ id: AppearanceTabId; label: string }> = [
  { id: 'theme', label: 'Theme' },
  { id: 'layout', label: 'Layout' },
  { id: 'visualTweaks', label: 'Visual Tweaks' },
];

const SECTION_LABELS: Record<SettingsSectionId, string> = {
  general: 'General',
  timer: 'Timer',
  appearance: 'Appearance',
};

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, replaceSettings } = useSettings();
  const [activeSection, setActiveSection] = React.useState<SettingsSectionId>('general');
  const [generalTab, setGeneralTab] = React.useState<GeneralTabId>('behavior');
  const [timerTab, setTimerTab] = React.useState<TimerTabId>('mode');
  const [appearanceTab, setAppearanceTab] = React.useState<AppearanceTabId>('theme');
  const [draftSettings, setDraftSettings] = React.useState<AppSettings>(settings);

  const cloneSettings = React.useCallback((value: AppSettings) => JSON.parse(JSON.stringify(value)) as AppSettings, []);

  React.useEffect(() => {
    if (!isOpen) return;
    setDraftSettings(cloneSettings(settings));
  }, [cloneSettings, isOpen, settings]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraftSettings(cloneSettings(settings));
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [cloneSettings, isOpen, onClose, settings]);

  if (!isOpen) return null;

  const updateGeneral = (patch: Partial<GeneralSettings>) => {
    setDraftSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...patch },
    }));
  };

  const updateTimer = (patch: Partial<TimerSettings>) => {
    setDraftSettings((prev) => ({
      ...prev,
      timer: { ...prev.timer, ...patch },
    }));
  };

  const updateAppearance = (patch: Partial<AppearanceSettings>) => {
    setDraftSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...patch },
    }));
  };

  const handleCancel = () => {
    setDraftSettings(cloneSettings(settings));
    onClose();
  };

  const handleSave = () => {
    replaceSettings(draftSettings);
    onClose();
  };

  const handleResetDraft = () => {
    setDraftSettings(cloneSettings(DEFAULT_SETTINGS));
  };

  const isDirty = JSON.stringify(draftSettings) !== JSON.stringify(settings);
  const activeSectionLabel = SECTION_LABELS[activeSection];

  const renderSection = () => {
    switch (activeSection) {
      case 'timer':
        return (
          <>
            <SettingsTabs tabs={TIMER_TABS} activeTab={timerTab} onChange={setTimerTab} />
            <TimerSettingsSection activeTab={timerTab} settings={draftSettings} updateTimer={updateTimer} />
          </>
        );
      case 'appearance':
        return (
          <>
            <SettingsTabs tabs={APPEARANCE_TABS} activeTab={appearanceTab} onChange={setAppearanceTab} />
            <AppearanceSettingsSection activeTab={appearanceTab} settings={draftSettings} updateAppearance={updateAppearance} />
          </>
        );
      case 'general':
      default:
        return (
          <>
            <SettingsTabs tabs={GENERAL_TABS} activeTab={generalTab} onChange={setGeneralTab} />
            <GeneralSettingsSection activeTab={generalTab} settings={draftSettings} updateGeneral={updateGeneral} />
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="Settings">
      <button type="button" className="flex-1 cursor-default" aria-label="Close settings overlay" onClick={handleCancel} />
      <div className="flex h-full w-full max-w-5xl overflow-hidden bg-white shadow-2xl">
        <SettingsSidebar activeSection={activeSection} onChange={setActiveSection} onClose={handleCancel} />
        <div className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex items-start justify-between border-b border-violet-100 px-8 py-6">
            <div>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900">{activeSectionLabel}</h2>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close settings"
              title="Close"
            >
              <CloseIcon size="sm" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-6">{renderSection()}</div>
          </div>

          <div className="flex items-center justify-between border-t border-violet-100 bg-white px-8 py-4">
            <button
              type="button"
              onClick={handleResetDraft}
              className="rounded-md px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            >
              Reset
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

