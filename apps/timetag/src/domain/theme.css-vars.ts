import { normalizeCustomThemeSettings } from './theme.palette';
import { DEFAULT_CUSTOM_THEME_SETTINGS } from './theme.presets';
import { resolveThemeTokens } from './theme.tokens';
import type { CustomThemeSettings, ThemeMode, ThemeTokens } from './theme.types';

export type ThemeCssVarTokenKey = Exclude<keyof ThemeTokens, 'isGlass' | 'colorScheme'>;

export const THEME_TOKEN_CSS_VARIABLES: Record<ThemeCssVarTokenKey, string> = {
  appBackground: '--tt-app-bg',
  appBackgroundColor: '--tt-app-bg-color',
  surface: '--tt-surface',
  surfaceMuted: '--tt-surface-muted',
  surfaceSubtle: '--tt-surface-subtle',
  surfaceHover: '--tt-surface-hover',
  surfaceElevated: '--tt-surface-elevated',
  border: '--tt-border',
  borderStrong: '--tt-border-strong',
  text: '--tt-text',
  textMuted: '--tt-text-muted',
  textSoft: '--tt-text-soft',
  accent: '--tt-accent',
  accentHover: '--tt-accent-hover',
  accentSoft: '--tt-accent-soft',
  accentContrast: '--tt-accent-contrast',
  inputBackground: '--tt-input-bg',
  chip: '--tt-chip-bg',
  chipText: '--tt-chip-text',
  chipIdleBg: '--tt-chip-idle-bg',
  chipIdleText: '--tt-chip-idle-text',
  chipIdleIcon: '--tt-chip-idle-icon',
  chipActive: '--tt-chip-active-bg',
  chipActiveText: '--tt-chip-active-text',
  chipActiveIcon: '--tt-chip-active-icon',
  chipActiveBorder: '--tt-chip-active-border',
  chipPausedBg: '--tt-chip-paused-bg',
  chipPausedText: '--tt-chip-paused-text',
  chipPausedIcon: '--tt-chip-paused-icon',
  chipPausedBorder: '--tt-chip-paused-border',
  chipWarning: '--tt-chip-warning-bg',
  chipWarningText: '--tt-chip-warning-text',
  chipWarningBorder: '--tt-chip-warning-border',
  chipDanger: '--tt-chip-danger-bg',
  chipDangerText: '--tt-chip-danger-text',
  chipZeroBg: '--tt-chip-zero-bg',
  chipZeroText: '--tt-chip-zero-text',
  chipZeroBorder: '--tt-chip-zero-border',
  chipOverdueBg: '--tt-chip-overdue-bg',
  chipOverdueText: '--tt-chip-overdue-text',
  ringTrack: '--tt-ring-track',
  ringNormalFrom: '--tt-ring-normal-from',
  ringNormalTo: '--tt-ring-normal-to',
  ringRunningFrom: '--tt-ring-running-from',
  ringRunningTo: '--tt-ring-running-to',
  ringPausedFrom: '--tt-ring-paused-from',
  ringPausedTo: '--tt-ring-paused-to',
  ringZeroFrom: '--tt-ring-zero-from',
  ringZeroTo: '--tt-ring-zero-to',
  ringWarnFrom: '--tt-ring-warn-from',
  ringWarnTo: '--tt-ring-warn-to',
  ringDangerFrom: '--tt-ring-danger-from',
  ringDangerTo: '--tt-ring-danger-to',
  ringOverdueFrom: '--tt-ring-overdue-from',
  ringOverdueTo: '--tt-ring-overdue-to',
  selectedRowBg: '--tt-selected-row-bg',
  selectedRowBorder: '--tt-selected-row-border',
  rowHover: '--tt-row-hover',
  overlay: '--tt-overlay',
  shadow: '--tt-shadow',
  shadowSoft: '--tt-shadow-soft',
  ring: '--tt-ring',
};

export const THEME_ALIAS_VARIABLES = {
  background: 'appBackground',
  foreground: 'text',
} as const satisfies Record<'background' | 'foreground', ThemeCssVarTokenKey>;

interface ThemeRootLike {
  dataset: DOMStringMap;
  style: {
    colorScheme: string;
    setProperty: (property: string, value: string) => void;
  };
}

export function applyThemeTokensToRoot(root: ThemeRootLike, args: {
  mode: ThemeMode;
  presetId: string;
  tokens: ThemeTokens;
}) {
  const { mode, presetId, tokens } = args;

  root.dataset.themeMode = mode;
  root.dataset.themePreset = mode === 'custom' ? presetId : mode;
  root.dataset.themeSurface = tokens.isGlass ? 'glass' : 'solid';
  root.style.colorScheme = tokens.colorScheme;

  root.style.setProperty('--background', tokens[THEME_ALIAS_VARIABLES.background]);
  root.style.setProperty('--foreground', tokens[THEME_ALIAS_VARIABLES.foreground]);

  for (const [tokenKey, cssVarName] of Object.entries(THEME_TOKEN_CSS_VARIABLES) as Array<[ThemeCssVarTokenKey, string]>) {
    root.style.setProperty(cssVarName, tokens[tokenKey]);
  }
}

export function applyThemeToDocument(
  mode: ThemeMode,
  customTheme: CustomThemeSettings = DEFAULT_CUSTOM_THEME_SETTINGS,
  doc: Document = document,
): ThemeTokens {
  const safeCustomTheme = normalizeCustomThemeSettings(customTheme);
  const tokens = resolveThemeTokens(mode, safeCustomTheme);

  applyThemeTokensToRoot(doc.documentElement, {
    mode,
    presetId: safeCustomTheme.presetId,
    tokens,
  });

  return tokens;
}

