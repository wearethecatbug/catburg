'use client';

import type { SettingsSectionId } from '@/domain/settings.types';
import { SettingsIcon } from '@/shared';
import { SETTINGS_SECTIONS } from './settings-sections.config';

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onChange: (section: SettingsSectionId) => void;
}

export function SettingsSidebar({ activeSection, onChange }: SettingsSidebarProps) {
  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r px-0"
      style={{
        borderColor: 'var(--tt-border)',
        background: 'linear-gradient(180deg, var(--tt-accent-soft) 0%, var(--tt-surface-elevated) 28%, var(--tt-surface) 100%)',
      }}
    >
      <div className="border-b px-5 py-5" style={{ borderColor: 'var(--tt-border)' }}>
        <div className="flex items-center gap-3" style={{ color: 'var(--tt-accent)' }}>
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}
          >
            <SettingsIcon size="sm" aria-hidden />
          </span>
          <div>
            <p className="text-xl font-semibold" style={{ color: 'var(--tt-text)' }}>Settings</p>
            <p className="text-xs" style={{ color: 'var(--tt-text-muted)' }}>General, Timer, Appearance</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={[
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
              activeSection === section.id
                ? 'font-semibold shadow-sm'
                : '',
            ].join(' ')}
            style={activeSection === section.id
              ? {
                background: 'var(--tt-accent-soft)',
                color: 'var(--tt-accent)',
                boxShadow: 'var(--tt-shadow)',
              }
              : {
                color: 'var(--tt-text-muted)',
              }}
            aria-current={activeSection === section.id ? 'page' : undefined}
          >
            <span style={{ color: activeSection === section.id ? 'var(--tt-accent)' : 'var(--tt-text-soft)' }}>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </nav>

    </aside>
  );
}

