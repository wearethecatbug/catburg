'use client';

import React from 'react';
import type { SettingsSectionId } from '@/domain/settings.types';
import { ClipboardIcon, HourglassIcon, SettingsIcon, SunIcon } from '@/shared';

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onChange: (section: SettingsSectionId) => void;
  onClose: () => void;
}

const SECTIONS: Array<{ id: SettingsSectionId; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General', icon: <ClipboardIcon size="sm" aria-hidden /> },
  { id: 'timer', label: 'Timer', icon: <HourglassIcon size="sm" aria-hidden /> },
  { id: 'appearance', label: 'Appearance', icon: <SunIcon size="sm" aria-hidden /> },
];

export function SettingsSidebar({ activeSection, onChange, onClose }: SettingsSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-violet-100 bg-gradient-to-b from-violet-50 via-white to-violet-50/60">
      <div className="border-b border-violet-100 px-5 py-5">
        <div className="flex items-center gap-3 text-violet-700">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <SettingsIcon size="sm" aria-hidden />
          </span>
          <div>
            <p className="text-xl font-semibold text-gray-900">Settings</p>
            <p className="text-xs text-gray-500">General, Timer, Appearance</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Settings sections">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={[
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
              activeSection === section.id
                ? 'bg-violet-100 font-semibold text-violet-800 shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-gray-900',
            ].join(' ')}
            aria-current={activeSection === section.id ? 'page' : undefined}
          >
            <span className={activeSection === section.id ? 'text-violet-700' : 'text-gray-400'}>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-violet-100 p-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
        >
          Close
        </button>
      </div>
    </aside>
  );
}

