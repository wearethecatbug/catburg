'use client';

import React from 'react';

interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface SettingsTabsProps<T extends string> {
  tabs: Array<TabItem<T>>;
  activeTab: T;
  onChange: (tab: T) => void;
}

export function SettingsTabs<T extends string>({ tabs, activeTab, onChange }: SettingsTabsProps<T>) {
  return (
    <div className="flex flex-wrap gap-6 border-b" role="tablist" aria-label="Settings tabs" style={{ borderColor: 'var(--tt-border)' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              'border-b-2 px-0 pb-3 pt-1 text-sm transition-colors',
              isActive
                ? 'font-semibold'
                : 'border-transparent',
            ].join(' ')}
            style={isActive
              ? { borderColor: 'var(--tt-accent)', color: 'var(--tt-accent)' }
              : { color: 'var(--tt-text-muted)' }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

