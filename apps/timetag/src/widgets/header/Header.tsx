'use client';

import React from 'react';
import {
  SettingsIcon,
  SunIcon,
  MoonIcon,
  SparklesIcon,
  MuteIcon,
  BellIcon,
  UserIcon,
} from '@/shared';
import { getNextThemeMode, getThemeModeLabel } from '@/domain/theme';
import { useSettings } from '@/store';

interface HeaderProps {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { settings, updateAppearance } = useSettings();
  const themeMode = settings.appearance.themeMode;
  const nextThemeMode = getNextThemeMode(themeMode);
  const themeLabel = getThemeModeLabel(themeMode);
  const nextThemeLabel = getThemeModeLabel(nextThemeMode);

  const ThemeIcon = themeMode === 'dark'
    ? MoonIcon
    : themeMode === 'custom'
      ? SparklesIcon
      : SunIcon;

  const handleThemeCycle = () => {
    updateAppearance({ themeMode: nextThemeMode });
  };

  return (
    <header
      className="flex items-center justify-between border-b px-4 py-3"
      style={{
        background: 'var(--tt-surface)',
        borderColor: 'var(--tt-border)',
        color: 'var(--tt-text)',
        backdropFilter: 'blur(18px) saturate(1.08)',
      }}
    >
      {/* Left — Settings */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg p-2"
          style={{ color: 'var(--tt-text-muted)' }}
          aria-label="Settings"
        >
          <SettingsIcon size="md" />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--tt-text)' }}>Settings</span>
      </div>

      {/* Right — compact global controls */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={handleThemeCycle}
          className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
          style={{
            borderColor: 'var(--tt-border)',
            background: 'var(--tt-surface-subtle)',
            color: 'var(--tt-text)',
          }}
          aria-label={`Theme: ${themeLabel}. Switch to ${nextThemeLabel}`}
          title={`Theme: ${themeLabel} · Click to switch to ${nextThemeLabel}`}
        >
          <ThemeIcon size="sm" />
          <span>{themeLabel}</span>
        </button>

        {/* Mute toggle */}
        <button
          type="button"
          className="rounded-lg p-2"
          style={{ color: 'var(--tt-text-muted)' }}
          aria-label="Toggle mute"
        >
          <MuteIcon size="md" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative rounded-lg p-2"
          style={{ color: 'var(--tt-text-muted)' }}
          aria-label="Notifications"
        >
          <BellIcon size="md" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Profile */}
        <button
          type="button"
          className="rounded-lg p-2"
          style={{ color: 'var(--tt-text-muted)' }}
          aria-label="Profile"
        >
          <UserIcon size="md" />
        </button>
      </div>
    </header>
  );
}


