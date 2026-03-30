'use client';

import { useEffect } from 'react';
import { applyThemeToDocument } from '@/domain/theme';
import { useSettings } from '@/store';

export function ThemeController() {
  const { settings, isHydrated } = useSettings();

  useEffect(() => {
    if (!isHydrated) return;

    applyThemeToDocument(settings.appearance.themeMode, settings.appearance.customTheme);
  }, [
    isHydrated,
    settings.appearance.customTheme,
    settings.appearance.themeMode,
  ]);

  return null;
}
