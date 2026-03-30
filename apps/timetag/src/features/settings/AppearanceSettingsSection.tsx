'use client';

import React from 'react';
import type { AppearanceSettings, AppearanceTabId, AppSettings } from '@/domain/settings.types';
import {
  CUSTOM_THEME_PRESETS,
  DEFAULT_CUSTOM_THEME_SETTINGS,
  getCustomThemePresetById,
  resolveThemeTokens,
} from '@/domain/theme';

interface AppearanceSettingsSectionProps {
  activeTab: AppearanceTabId;
  settings: AppSettings;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
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

export function AppearanceSettingsSection({ activeTab, settings, updateAppearance }: AppearanceSettingsSectionProps) {
  const customThemePreset = getCustomThemePresetById(settings.appearance.customTheme.presetId);
  const customOverrides = settings.appearance.customTheme.overrides;

  const previewMode = settings.appearance.themeMode === 'custom'
    ? 'custom'
    : settings.appearance.themeMode;
  const previewTokens = resolveThemeTokens(previewMode, settings.appearance.customTheme);

  const updateCustomTheme = (patch: Partial<AppearanceSettings['customTheme']>) => {
    updateAppearance({
      customTheme: {
        ...settings.appearance.customTheme,
        ...patch,
      },
    });
  };

  const updateCustomOverrides = (patch: Partial<AppearanceSettings['customTheme']['overrides']>) => {
    updateCustomTheme({
      overrides: {
        ...settings.appearance.customTheme.overrides,
        ...patch,
      },
    });
  };

  if (activeTab === 'theme') {
    return (
      <div className="space-y-3">
        <Field label="Theme" description="Persist the preferred app theme mode and use the Header button as a global quick switcher.">
          <select
            value={settings.appearance.themeMode}
            onChange={(e) => updateAppearance({ themeMode: e.target.value as typeof settings.appearance.themeMode })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Theme mode"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="custom">Custom</option>
          </select>
        </Field>

        <Field label="Custom preset" description="Custom mode starts from a preset, then applies your overrides on top.">
          <select
            value={settings.appearance.customTheme.presetId}
            onChange={(e) => updateCustomTheme({ presetId: e.target.value as typeof settings.appearance.customTheme.presetId })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Custom theme preset"
          >
            {CUSTOM_THEME_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Custom theme overrides</h3>
              <p className="mt-1 text-xs text-gray-500">
                {customThemePreset.description}
                {' '}
                If an override becomes invalid or is cleared, the preset fallback is used automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateAppearance({ customTheme: DEFAULT_CUSTOM_THEME_SETTINGS })}
              className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset to Airy Glass
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { id: 'background', label: 'Background', value: customOverrides.background ?? customThemePreset.backgroundColor },
              { id: 'surface', label: 'Surface', value: customOverrides.surface ?? customThemePreset.surface },
              { id: 'accent', label: 'Accent', value: customOverrides.accent ?? customThemePreset.accent },
              { id: 'text', label: 'Text', value: customOverrides.text ?? customThemePreset.text },
              { id: 'border', label: 'Border', value: customOverrides.border ?? customThemePreset.border },
            ].map((field) => (
              <label key={field.id} className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">{field.label}</span>
                <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-2">
                  <input
                    type="color"
                    value={field.value}
                    onChange={(event) => updateCustomOverrides({ [field.id]: event.target.value })}
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={`${field.label} color`}
                  />
                  <span className="text-sm text-gray-700">{field.value.toUpperCase()}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Theme preview</h3>
              <p className="mt-1 text-xs text-gray-500">
                Preview reflects the currently selected mode. Changes here are applied globally after saving settings.
              </p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{
              background: previewTokens.accentSoft,
              color: previewTokens.accent,
            }}>
              {settings.appearance.themeMode === 'custom' ? customThemePreset.label : settings.appearance.themeMode}
            </span>
          </div>

          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              background: previewTokens.appBackground,
              borderColor: previewTokens.border,
              boxShadow: previewTokens.shadow,
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{
                background: previewTokens.surfaceElevated,
                borderColor: previewTokens.border,
                color: previewTokens.text,
                backdropFilter: previewTokens.isGlass ? 'blur(18px) saturate(1.1)' : undefined,
              }}
            >
              <span className="text-sm font-semibold">TimeTag</span>
              <span className="rounded-full px-2 py-1 text-xs font-medium" style={{
                background: previewTokens.accentSoft,
                color: previewTokens.accent,
              }}>
                {settings.appearance.themeMode}
              </span>
            </div>
            <div className="space-y-3 p-4" style={{ color: previewTokens.text }}>
              <div className="rounded-xl border px-3 py-3" style={{
                background: previewTokens.surface,
                borderColor: previewTokens.border,
                backdropFilter: previewTokens.isGlass ? 'blur(16px) saturate(1.08)' : undefined,
              }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Finish project report</p>
                    <p className="mt-1 text-xs" style={{ color: previewTokens.textMuted }}>Airy Glass is the safe fallback for custom mode.</p>
                  </div>
                  <span className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{
                    background: previewTokens.accent,
                    color: previewTokens.accentContrast,
                  }}>
                    25m
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    background: previewTokens.surfaceSubtle,
                    border: `1px solid ${previewTokens.border}`,
                    color: previewTokens.textMuted,
                  }}
                >
                  Search
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    background: previewTokens.accent,
                    color: previewTokens.accentContrast,
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
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

