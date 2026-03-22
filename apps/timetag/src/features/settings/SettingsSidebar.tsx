'use client';

import React from 'react';
import type { SettingsSectionId } from '@/domain/settings.types';

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onChange: (section: SettingsSectionId) => void;
}

const SECTIONS: Array<{ id: SettingsSectionId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'timer', label: 'Timer' },
  { id: 'appearance', label: 'Appearance' },
];

export function SettingsSidebar({ activeSection, onChange }: SettingsSidebarProps) {
  return (
    <aside className="w-48 shrink-0 border-r border-gray-200 bg-gray-50/80 p-3">
      <nav className="space-y-1" aria-label="Settings sections">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={[
              'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
              activeSection === section.id
                ? 'bg-white font-semibold text-gray-900 shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-gray-900',
            ].join(' ')}
            aria-current={activeSection === section.id ? 'page' : undefined}
          >
            {section.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

