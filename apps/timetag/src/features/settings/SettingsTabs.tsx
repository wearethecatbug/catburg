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
    <div className="flex flex-wrap gap-5 border-b border-gray-200" role="tablist" aria-label="Settings tabs">
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
              'border-b-2 px-0 pb-2 pt-1 text-sm transition-colors',
              isActive
                ? 'border-gray-900 font-semibold text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

