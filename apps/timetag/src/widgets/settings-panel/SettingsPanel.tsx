'use client';

import React from 'react';
import type {
  AppearanceTabId,
  GeneralTabId,
  SettingsSectionId,
  TimerTabId,
} from '@/domain/settings.types';
import { SettingsSidebar } from '@/features/settings';
import { SECTION_LABELS, SETTINGS_SECTIONS } from '@/features/settings/settings-sections.config';
import { CloseIcon, SettingsIcon } from '@/shared';
import { SettingsPanelFooter } from './SettingsPanelFooter';
import { SettingsPanelSection } from './SettingsPanelSection';
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
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const desktopCloseRef = React.useRef<HTMLButtonElement>(null);
  const mobileCloseRef = React.useRef<HTMLButtonElement>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const closeRequestedRef = React.useRef(false);
  const openerRestoredRef = React.useRef(false);

  const restoreOpener = React.useCallback(() => {
    if (openerRestoredRef.current) return;
    openerRestoredRef.current = true;
    if (openerRef.current?.isConnected && document.activeElement !== openerRef.current) {
      openerRef.current.focus();
    }
  }, []);

  const requestCancel = React.useCallback(() => {
    if (closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    handleCancel();
  }, [handleCancel]);

  const requestSave = React.useCallback(() => {
    if (closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    handleSave();
  }, [handleSave]);

  React.useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!isOpen) {
      if (dialog.open) dialog.close();
      restoreOpener();
      return;
    }

    closeRequestedRef.current = false;
    openerRestoredRef.current = false;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();

    const frame = window.requestAnimationFrame(() => {
      [mobileCloseRef.current, desktopCloseRef.current]
        .find((button) => button?.getClientRects().length)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      restoreOpener();
    };
  }, [isOpen, restoreOpener]);

  const handleDialogCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestCancel();
  };

  const handleDialogClose = () => {
    // A queued close event from a previous native dialog instance must not cancel
    // the draft after this same node has already been reopened.
    if (dialogRef.current?.open) return;
    if (!closeRequestedRef.current) {
      requestCancel();
    }
    restoreOpener();
  };

  const activeSectionLabel = SECTION_LABELS[activeSection];
  const mobileSectionSubtitle = SETTINGS_SECTIONS.map((section) => section.label).join(', ');

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog fixed inset-0 z-50 h-screen w-screen max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0"
      aria-label="Settings"
      onCancel={handleDialogCancel}
      onClose={handleDialogClose}
      style={{ margin: 0, background: 'var(--tt-overlay)', backdropFilter: 'blur(1px)' }}
    >
      {/* Keep the native closed state display-controlled so it cannot expose hidden descendants. */}
      <style>{'.settings-dialog[open] { display: flex; justify-content: flex-end; } .settings-dialog::backdrop { background: transparent; }'}</style>
      {isOpen && <>
      <button type="button" className="flex-1 cursor-default max-[700px]:hidden" aria-label="Close settings overlay" onClick={requestCancel} />
      <div
        className="flex h-full w-full max-w-5xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--tt-surface-elevated)',
          boxShadow: 'var(--tt-shadow)',
          backdropFilter: 'blur(18px) saturate(1.08)',
        }}
      >
        <div className="max-[700px]:hidden">
          <SettingsSidebar activeSection={activeSection} onChange={setActiveSection} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col" style={{ background: 'var(--tt-surface-elevated)' }}>
          <div
            className="hidden border-b px-5 py-5 max-[700px]:block"
            style={{
              borderColor: 'var(--tt-border)',
              background: 'linear-gradient(180deg, var(--tt-accent-soft) 0%, var(--tt-surface-elevated) 42%, var(--tt-surface) 100%)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{
                    background: 'color-mix(in srgb, var(--tt-accent-soft) 72%, var(--tt-surface-elevated))',
                    color: 'var(--tt-accent)',
                  }}
                >
                  <SettingsIcon size="sm" aria-hidden />
                </span>
                <div>
                  <p className="text-xl font-semibold" style={{ color: 'var(--tt-text)' }}>
                    Settings
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: 'color-mix(in srgb, var(--tt-text-muted) 88%, white)' }}>
                    {mobileSectionSubtitle}
                  </p>
                </div>
              </div>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={requestCancel}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                style={{ color: 'var(--tt-text-soft)' }}
                aria-label="Close settings"
                title="Close"
              >
                <CloseIcon size="sm" aria-hidden />
              </button>
            </div>

            <nav className="mt-5" aria-label="Settings sections mobile navigation">
              <div className="flex flex-wrap gap-2">
                {SETTINGS_SECTIONS.map((section) => {
                  const isActive = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveSection(section.id)}
                      className={[
                        'rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                        isActive ? 'font-semibold shadow-sm' : '',
                      ].join(' ')}
                      style={isActive
                        ? {
                            background: 'color-mix(in srgb, var(--tt-accent-soft) 80%, var(--tt-surface-elevated))',
                            color: 'color-mix(in srgb, var(--tt-accent) 92%, white)',
                            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.06)',
                          }
                        : {
                            color: 'var(--tt-text-muted)',
                          }}
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <span style={{ color: isActive ? 'var(--tt-accent)' : 'var(--tt-text-soft)' }}>
                          {section.icon}
                        </span>
                        <span>{section.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="flex items-start justify-between border-b px-8 py-6 max-[700px]:hidden" style={{ borderColor: 'var(--tt-border)' }}>
            <div>
              <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--tt-text)' }}>{activeSectionLabel}</h2>
            </div>
            <button
              ref={desktopCloseRef}
              type="button"
              onClick={requestCancel}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
              style={{ color: 'var(--tt-text-soft)' }}
              aria-label="Close settings"
              title="Close"
            >
              <CloseIcon size="sm" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 max-[700px]:px-5 max-[700px]:py-4">
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
            onCancel={requestCancel}
            onSave={requestSave}
          />
        </div>
      </div>
      </>}
    </dialog>
  );
}

