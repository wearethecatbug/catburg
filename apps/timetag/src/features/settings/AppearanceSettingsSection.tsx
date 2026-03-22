'use client';

import React from 'react';
import type { AppearanceTabId } from '@/domain/settings.types';
import { useSettings } from '@/store';

interface AppearanceSettingsSectionProps {
  activeTab: AppearanceTabId;
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
      <span className="space-y-1">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="block text-xs text-gray-500">{description}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </label>
  );
}

export function AppearanceSettingsSection({ activeTab }: AppearanceSettingsSectionProps) {
  const { settings, updateAppearance } = useSettings();

  if (activeTab === 'theme') {
    return (
      <div className="space-y-3">
        <Field label="Theme" description="Persist the preferred app theme mode.">
          <select
            value={settings.appearance.themeMode}
            onChange={(e) => updateAppearance({ themeMode: e.target.value as typeof settings.appearance.themeMode })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Theme mode"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </Field>
      </div>
    );
  }

  if (activeTab === 'layout') {
    return (
      <div className="space-y-3">
        <Field label="Compact list" description="Reduce spacing in task rows for denser scanning.">
          <input
            type="checkbox"
            checked={settings.appearance.compactList}
            onChange={(e) => updateAppearance({ compactList: e.target.checked })}
            aria-label="Compact list"
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Animations" description="Keep small interface transitions enabled.">
        <input
          type="checkbox"
          checked={settings.appearance.animationsEnabled}
          onChange={(e) => updateAppearance({ animationsEnabled: e.target.checked })}
          aria-label="Animations"
        />
      </Field>

      <Field label="Rounded corners" description="Adjust the global corner softness for future UI components.">
        <input
          type="range"
          min={0}
          max={24}
          step={2}
          value={settings.appearance.roundedCorners}
          onChange={(e) => updateAppearance({ roundedCorners: Number(e.target.value) })}
          aria-label="Rounded corners"
        />
      </Field>

      <Field label="Ring thickness" description="Reserved for progress and urgency ring styling.">
        <input
          type="range"
          min={1}
          max={6}
          step={1}
          value={settings.appearance.ringThickness}
          onChange={(e) => updateAppearance({ ringThickness: Number(e.target.value) })}
          aria-label="Ring thickness"
        />
      </Field>
    </div>
  );
}

