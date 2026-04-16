import type { CustomThemeOverrides, CustomThemeSettings, ThemeMode, ThemePalette } from './theme.types';
import { normalizeHex } from './theme.colors';
import {
  CUSTOM_THEME_PRESETS,
  DARK_THEME,
  DEFAULT_CUSTOM_THEME_SETTINGS,
  LIGHT_THEME,
} from './theme.presets';

export function normalizeOptionalHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = normalizeHex(value);
  return normalized || undefined;
}

export function normalizeCustomThemeSettings(raw: unknown): CustomThemeSettings {
  const fallback = DEFAULT_CUSTOM_THEME_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return fallback;

  const candidate = raw as { presetId?: unknown; overrides?: unknown };
  const presetId = CUSTOM_THEME_PRESETS.some((preset) => preset.id === candidate.presetId)
    ? candidate.presetId as CustomThemeSettings['presetId']
    : fallback.presetId;
  const safeOverrides = typeof candidate.overrides === 'object' && candidate.overrides !== null
    ? candidate.overrides as Record<string, unknown>
    : {};

  const overrides: CustomThemeOverrides = {
    background: normalizeOptionalHex(safeOverrides.background),
    surface: normalizeOptionalHex(safeOverrides.surface),
    accent: normalizeOptionalHex(safeOverrides.accent),
    text: normalizeOptionalHex(safeOverrides.text),
    border: normalizeOptionalHex(safeOverrides.border),
  };

  return { presetId, overrides };
}

export function buildThemePalette(mode: ThemeMode, customTheme: CustomThemeSettings): ThemePalette {
  if (mode === 'light') return LIGHT_THEME;
  if (mode === 'dark') return DARK_THEME;

  const preset = CUSTOM_THEME_PRESETS.find((candidate) => candidate.id === customTheme.presetId)
    ?? CUSTOM_THEME_PRESETS[0];

  return {
    ...preset,
    background: customTheme.overrides.background ?? preset.background,
    backgroundColor: customTheme.overrides.background ?? preset.backgroundColor,
    surface: customTheme.overrides.surface ?? preset.surface,
    accent: customTheme.overrides.accent ?? preset.accent,
    text: customTheme.overrides.text ?? preset.text,
    border: customTheme.overrides.border ?? preset.border,
  };
}

export interface ThemeBootstrapPayload {
  storageKey: string;
  defaultMode: ThemeMode;
  defaultCustomTheme: CustomThemeSettings;
  presets: typeof CUSTOM_THEME_PRESETS;
  lightTheme: typeof LIGHT_THEME;
  darkTheme: typeof DARK_THEME;
}


