'use client';

import React from 'react';
import type {
  AppearanceTabId,
  GeneralTabId,
  SettingsSectionId,
  TimerTabId,
} from '@/domain/settings.types';
import { SettingsSidebar } from '@/features/settings';
import { CloseIcon } from '@/shared';
import { SettingsPanelFooter } from './SettingsPanelFooter';
import { SettingsPanelSection } from './SettingsPanelSection';
import { SECTION_LABELS } from './settings-panel.config';
import { useSettingsDraft } from './useSettingsDraft';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = React.useState<SettingsSectionId>('general');
  const [generalTab, setGeneralTab] = React.useState<GeneralTabId>('behavior');
  const [timerTab, setTimerTab] = React.useState<TimerTabId>('mode');
  const [appearanceTab, setAppearanceTab] = React.useState<AppearanceTabId>('theme');
  const {
    draftSettings,
    updateGeneral,
    updateTimer,
    updateAppearance,
    handleCancel,
    handleSave,
    handleResetDraft,
    isDirty,
  } = useSettingsDraft({ isOpen, onClose });

  if (!isOpen) return null;
  const activeSectionLabel = SECTION_LABELS[activeSection];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end backdrop-blur-[1px]"
      style={{ background: 'var(--tt-overlay)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <button type="button" className="flex-1 cursor-default" aria-label="Close settings overlay" onClick={handleCancel} />
      <div
        className="flex h-full w-full max-w-5xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--tt-surface-elevated)',
          boxShadow: 'var(--tt-shadow)',
          backdropFilter: 'blur(18px) saturate(1.08)',
        }}
      >
        <SettingsSidebar activeSection={activeSection} onChange={setActiveSection} onClose={handleCancel} />
        <div className="flex min-w-0 flex-1 flex-col" style={{ background: 'var(--tt-surface-elevated)' }}>
          <div className="flex items-start justify-between border-b px-8 py-6" style={{ borderColor: 'var(--tt-border)' }}>
            <div>
              <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--tt-text)' }}>{activeSectionLabel}</h2>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
              style={{ color: 'var(--tt-text-soft)' }}
              aria-label="Close settings"
              title="Close"
            >
              <CloseIcon size="sm" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-6">
              <SettingsPanelSection
                activeSection={activeSection}
                generalTab={generalTab}
                timerTab={timerTab}
                appearanceTab={appearanceTab}
                onGeneralTabChange={setGeneralTab}
                onTimerTabChange={setTimerTab}
                onAppearanceTabChange={setAppearanceTab}
                settings={draftSettings}
                updateGeneral={updateGeneral}
                updateTimer={updateTimer}
                updateAppearance={updateAppearance}
              />
            </div>
          </div>

          <SettingsPanelFooter
            isDirty={isDirty}
            onReset={handleResetDraft}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}

