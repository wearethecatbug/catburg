'use client';

import React from 'react';
import type {
  AppearanceTabId,
  GeneralTabId,
  SettingsSectionId,
  TimerTabId,
} from '@/domain/settings.types';
import { useSettings } from '@/store';
import {
  AppearanceSettingsSection,
  GeneralSettingsSection,
  SettingsSidebar,
  SettingsTabs,
  TimerSettingsSection,
} from '@/features/settings';

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
  { id: 'runtime', label: 'Runtime' },
];

const APPEARANCE_TABS: Array<{ id: AppearanceTabId; label: string }> = [
  { id: 'theme', label: 'Theme' },
  { id: 'layout', label: 'Layout' },
  { id: 'visualTweaks', label: 'Visual Tweaks' },
];

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { resetSettings } = useSettings();
  const [activeSection, setActiveSection] = React.useState<SettingsSectionId>('general');
  const [generalTab, setGeneralTab] = React.useState<GeneralTabId>('behavior');
  const [timerTab, setTimerTab] = React.useState<TimerTabId>('mode');
  const [appearanceTab, setAppearanceTab] = React.useState<AppearanceTabId>('theme');

  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderSection = () => {
    switch (activeSection) {
      case 'timer':
        return (
          <>
            <SettingsTabs tabs={TIMER_TABS} activeTab={timerTab} onChange={setTimerTab} />
            <TimerSettingsSection activeTab={timerTab} />
          </>
        );
      case 'appearance':
        return (
          <>
            <SettingsTabs tabs={APPEARANCE_TABS} activeTab={appearanceTab} onChange={setAppearanceTab} />
            <AppearanceSettingsSection activeTab={appearanceTab} />
          </>
        );
      case 'general':
      default:
        return (
          <>
            <SettingsTabs tabs={GENERAL_TABS} activeTab={generalTab} onChange={setGeneralTab} />
            <GeneralSettingsSection activeTab={generalTab} />
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/30" role="dialog" aria-modal="true" aria-label="Settings">
      <button type="button" className="flex-1 cursor-default" aria-label="Close settings overlay" onClick={onClose} />
      <div className="flex h-full w-full max-w-4xl bg-white shadow-2xl">
        <SettingsSidebar activeSection={activeSection} onChange={setActiveSection} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
              <p className="mt-1 text-sm text-gray-500">MVP settings scaffold for General, Timer, and Appearance.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetSettings}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">{renderSection()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

