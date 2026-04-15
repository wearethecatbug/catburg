export type ThemeMode = 'light' | 'dark' | 'custom';

export type CustomThemePresetId = 'airy-glass';

export interface CustomThemeOverrides {
  background?: string;
  surface?: string;
  accent?: string;
  text?: string;
  border?: string;
}

export interface CustomThemeSettings {
  presetId: CustomThemePresetId;
  overrides: CustomThemeOverrides;
}

export interface ThemePreset {
  id: CustomThemePresetId;
  label: string;
  description: string;
  background: string;
  backgroundColor: string;
  surface: string;
  accent: string;
  text: string;
  border: string;
  glass: boolean;
  colorScheme: 'light' | 'dark';
}

export interface ThemeTokens {
  appBackground: string;
  appBackgroundColor: string;
  surface: string;
  surfaceMuted: string;
  surfaceSubtle: string;
  surfaceHover: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentContrast: string;
  inputBackground: string;
  chip: string;
  chipText: string;
  chipIdleBg: string;
  chipIdleText: string;
  chipIdleIcon: string;
  chipActive: string;
  chipActiveText: string;
  chipActiveIcon: string;
  chipActiveBorder: string;
  chipPausedBg: string;
  chipPausedText: string;
  chipPausedIcon: string;
  chipWarning: string;
  chipWarningText: string;
  chipWarningBorder: string;
  chipDanger: string;
  chipDangerText: string;
  chipZeroBg: string;
  chipZeroText: string;
  chipZeroBorder: string;
  chipOverdueBg: string;
  chipOverdueText: string;
  ringTrack: string;
  ringNormalFrom: string;
  ringNormalTo: string;
  ringRunningFrom: string;
  ringRunningTo: string;
  ringPausedFrom: string;
  ringPausedTo: string;
  ringZeroFrom: string;
  ringZeroTo: string;
  ringWarnFrom: string;
  ringWarnTo: string;
  ringDangerFrom: string;
  ringDangerTo: string;
  ringOverdueFrom: string;
  ringOverdueTo: string;
  selectedRowBg: string;
  selectedRowBorder: string;
  rowHover: string;
  overlay: string;
  shadow: string;
  shadowSoft: string;
  ring: string;
  isGlass: boolean;
  colorScheme: 'light' | 'dark';
}

interface ThemePalette {
  background: string;
  backgroundColor: string;
  surface: string;
  accent: string;
  text: string;
  border: string;
  glass: boolean;
  colorScheme: 'light' | 'dark';
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const LIGHT_THEME: ThemePalette = {
  background: '#f6f8fb',
  backgroundColor: '#f6f8fb',
  surface: '#ffffff',
  accent: '#4f7df3',
  text: '#1e293b',
  border: '#e6eaf0',
  glass: false,
  colorScheme: 'light',
};

const DARK_THEME: ThemePalette = {
  background: '#0b1020',
  backgroundColor: '#0b1020',
  surface: '#151c30',
  accent: '#7c8dff',
  text: '#f5f7ff',
  border: '#2a3658',
  glass: false,
  colorScheme: 'dark',
};

export const CUSTOM_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'airy-glass',
    label: 'Airy Glass',
    description: 'Soft frosted blue-violet glass with a bright accent glow.',
    background: 'linear-gradient(135deg, #eef4ff 0%, #ddecff 48%, #efe8ff 100%)',
    backgroundColor: '#e7f0ff',
    surface: '#ffffff',
    accent: '#6d74ff',
    text: '#24314d',
    border: '#cad7ff',
    glass: true,
    colorScheme: 'light',
  },
];

export const DEFAULT_CUSTOM_THEME_SETTINGS: CustomThemeSettings = {
  presetId: 'airy-glass',
  overrides: {},
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex: string): string {
  const value = hex.trim();
  if (!HEX_COLOR_RE.test(value)) return '';

  if (value.length === 4) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return value.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return { r: 0, g: 0, b: 0 };
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(colorA: string, colorB: string, weight: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const ratio = clamp(weight, 0, 1);

  return rgbToHex(
    a.r + (b.r - a.r) * ratio,
    a.g + (b.g - a.g) * ratio,
    a.b + (b.b - a.b) * ratio,
  );
}

function alphaHex(color: string, alpha: number): string {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function darkenHex(color: string, amount: number): string {
  return mixHex(color, '#000000', clamp(amount, 0, 1));
}

function getAccentContrast(color: string): string {
  const { r, g, b } = hexToRgb(color);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.56 ? '#0f172a' : '#ffffff';
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'custom';
}

export function isCustomThemePresetId(value: unknown): value is CustomThemePresetId {
  return CUSTOM_THEME_PRESETS.some((preset) => preset.id === value);
}

export function getCustomThemePresetById(id: unknown): ThemePreset {
  return CUSTOM_THEME_PRESETS.find((preset) => preset.id === id) ?? CUSTOM_THEME_PRESETS[0];
}

export function getThemeModeLabel(mode: ThemeMode): string {
  switch (mode) {
    case 'dark':
      return 'Dark';
    case 'custom':
      return 'Custom';
    case 'light':
    default:
      return 'Light';
  }
}

export function getNextThemeMode(mode: ThemeMode): ThemeMode {
  switch (mode) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'custom';
    case 'custom':
    default:
      return 'light';
  }
}

export function normalizeCustomThemeSettings(raw: unknown): CustomThemeSettings {
  const fallback = DEFAULT_CUSTOM_THEME_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return fallback;

  const candidate = raw as { presetId?: unknown; overrides?: unknown };
  const presetId = isCustomThemePresetId(candidate.presetId) ? candidate.presetId : fallback.presetId;
  const safeOverrides = typeof candidate.overrides === 'object' && candidate.overrides !== null
    ? candidate.overrides as Record<string, unknown>
    : {};

  const overrides: CustomThemeOverrides = {
    background: typeof safeOverrides.background === 'string' && normalizeHex(safeOverrides.background)
      ? normalizeHex(safeOverrides.background)
      : undefined,
    surface: typeof safeOverrides.surface === 'string' && normalizeHex(safeOverrides.surface)
      ? normalizeHex(safeOverrides.surface)
      : undefined,
    accent: typeof safeOverrides.accent === 'string' && normalizeHex(safeOverrides.accent)
      ? normalizeHex(safeOverrides.accent)
      : undefined,
    text: typeof safeOverrides.text === 'string' && normalizeHex(safeOverrides.text)
      ? normalizeHex(safeOverrides.text)
      : undefined,
    border: typeof safeOverrides.border === 'string' && normalizeHex(safeOverrides.border)
      ? normalizeHex(safeOverrides.border)
      : undefined,
  };

  return { presetId, overrides };
}

function buildThemePalette(mode: ThemeMode, customTheme: CustomThemeSettings): ThemePalette {
  if (mode === 'light') return LIGHT_THEME;
  if (mode === 'dark') return DARK_THEME;

  const preset = getCustomThemePresetById(customTheme.presetId);

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

export function resolveThemeTokens(mode: ThemeMode, customTheme: CustomThemeSettings = DEFAULT_CUSTOM_THEME_SETTINGS): ThemeTokens {
  const palette = buildThemePalette(mode, normalizeCustomThemeSettings(customTheme));
  const backgroundReference = palette.backgroundColor;
  const isSolidLightTheme = !palette.glass && palette.colorScheme === 'light';
  const surfaceMuted = palette.glass
    ? alphaHex(palette.surface, 0.46)
    : isSolidLightTheme
      ? '#fcfdff'
      : mixHex(palette.surface, backgroundReference, 0.12);
  const surfaceSubtle = palette.glass
    ? alphaHex(palette.surface, 0.30)
    : isSolidLightTheme
      ? '#f2f4f8'
      : mixHex(palette.surface, backgroundReference, 0.24);
  const surfaceHover = palette.glass
    ? alphaHex(palette.surface, 0.88)
    : isSolidLightTheme
      ? '#f8fafc'
      : mixHex(palette.surface, palette.accent, 0.05);
  const surfaceElevated = palette.glass
    ? alphaHex(palette.surface, 0.74)
    : palette.colorScheme === 'dark'
      ? mixHex(palette.surface, '#1f2937', 0.18)
      : isSolidLightTheme
        ? '#ffffff'
        : palette.surface;
  const textMuted = isSolidLightTheme
    ? '#64748b'
    : mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.34 : 0.44);
  const textSoft = isSolidLightTheme
    ? '#94a3b8'
    : mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.54 : 0.62);
  const accentHover = isSolidLightTheme
    ? '#3f6ae0'
    : darkenHex(palette.accent, palette.colorScheme === 'dark' ? 0.08 : 0.14);
  const accentSoft = palette.glass
    ? alphaHex(palette.accent, 0.22)
    : isSolidLightTheme
      ? '#e8f0ff'
      : alphaHex(palette.accent, 0.16);
  const border = palette.glass ? alphaHex(palette.border, 0.60) : palette.border;
  const borderStrong = palette.glass
    ? alphaHex(palette.border, 0.84)
    : isSolidLightTheme
      ? '#d7dee7'
      : darkenHex(palette.border, palette.colorScheme === 'dark' ? 0.05 : 0.08);
  const inputBackground = palette.glass
    ? alphaHex(palette.surface, 0.58)
    : isSolidLightTheme
      ? '#ffffff'
      : mixHex(palette.surface, backgroundReference, 0.08);
  const chip = palette.colorScheme === 'dark'
    ? alphaHex('#94a3b8', 0.14)
    : isSolidLightTheme
      ? '#f1f5f9'
      : mixHex(palette.surface, backgroundReference, 0.22);
  const chipText = palette.colorScheme === 'dark'
    ? mixHex(palette.text, '#94a3b8', 0.22)
    : isSolidLightTheme
      ? '#334155'
      : textMuted;
  const chipIdleBg = palette.colorScheme === 'dark'
    ? alphaHex('#94a3b8', 0.08)
    : isSolidLightTheme
      ? '#f8fafc'
      : surfaceHover;
  const chipIdleText = palette.colorScheme === 'dark'
    ? mixHex(palette.text, '#94a3b8', 0.28)
    : isSolidLightTheme
      ? '#475569'
      : textMuted;
  const chipIdleIcon = palette.colorScheme === 'dark'
    ? mixHex(palette.text, backgroundReference, 0.54)
    : isSolidLightTheme
      ? '#94a3b8'
      : textSoft;
  const chipActive = palette.colorScheme === 'dark'
    ? alphaHex(palette.accent, 0.22)
    : isSolidLightTheme
      ? '#e8f0ff'
      : accentSoft;
  const chipActiveText = palette.colorScheme === 'dark'
    ? mixHex(palette.accent, '#ffffff', 0.18)
    : isSolidLightTheme
      ? '#3b5ccc'
      : palette.accent;
  const chipActiveIcon = palette.colorScheme === 'dark'
    ? mixHex(palette.accent, '#ffffff', 0.12)
    : isSolidLightTheme
      ? '#5b7cf6'
      : palette.accent;
  const chipActiveBorder = palette.colorScheme === 'dark'
    ? alphaHex(palette.accent, 0.20)
    : alphaHex(palette.accent, 0.10);
  const chipPausedBg = palette.colorScheme === 'dark' ? alphaHex('#94a3b8', 0.18) : '#e5eaf2';
  const chipPausedText = palette.colorScheme === 'dark' ? mixHex(palette.text, '#94a3b8', 0.26) : '#475569';
  const chipPausedIcon = palette.colorScheme === 'dark' ? mixHex(palette.text, '#94a3b8', 0.38) : '#64748b';
  const chipWarning = palette.colorScheme === 'dark' ? alphaHex('#e4d468', 0.22) : 'rgba(241, 225, 123, 0.18)';
  const chipWarningText = palette.colorScheme === 'dark' ? '#f2e58a' : '#8a741f';
  const chipWarningBorder = palette.colorScheme === 'dark' ? alphaHex('#e4d468', 0.30) : 'rgba(221, 198, 82, 0.24)';
  const chipDanger = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.16) : '#fff1f1';
  const chipDangerText = palette.colorScheme === 'dark' ? '#fca5a5' : '#a74f4f';
  const chipZeroBg = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.18) : 'rgba(239, 68, 68, 0.14)';
  const chipZeroText = palette.colorScheme === 'dark' ? '#f87171' : '#dc2626';
  const chipZeroBorder = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.30) : 'rgba(239, 68, 68, 0.24)';
  const chipOverdueBg = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.14) : 'rgba(239, 68, 68, 0.10)';
  const chipOverdueText = palette.colorScheme === 'dark' ? '#f87171' : '#b91c1c';
  const ringTrack = palette.colorScheme === 'dark'
    ? mixHex(palette.border, '#ffffff', 0.08)
    : isSolidLightTheme
      ? '#e6eaf0'
      : border;
  const ringNormalFrom = palette.colorScheme === 'dark'
    ? mixHex(palette.accent, '#ffffff', 0.22)
    : isSolidLightTheme
      ? '#d8e5ff'
      : mixHex(palette.accent, '#ffffff', 0.56);
  const ringNormalTo = palette.colorScheme === 'dark' ? palette.accent : isSolidLightTheme ? '#7fa6f6' : palette.accent;
  const ringRunningFrom = palette.colorScheme === 'dark' ? mixHex(palette.accent, '#ffffff', 0.28) : '#b2c2ff';
  const ringRunningTo = palette.colorScheme === 'dark' ? palette.accent : '#5b7cf6';
  const ringPausedFrom = palette.colorScheme === 'dark' ? mixHex('#94a3b8', '#ffffff', 0.16) : '#d1d9e4';
  const ringPausedTo = palette.colorScheme === 'dark' ? mixHex('#94a3b8', backgroundReference, 0.18) : '#9ca9ba';
  const ringZeroFrom = palette.colorScheme === 'dark' ? '#ffb2ba' : '#ffb2ba';
  const ringZeroTo = palette.colorScheme === 'dark' ? '#dc2626' : '#dc2626';
  const ringWarnFrom = palette.colorScheme === 'dark' ? '#f3e88f' : '#f6efb8';
  const ringWarnTo = palette.colorScheme === 'dark' ? '#d8c246' : '#ddc652';
  const ringDangerFrom = palette.colorScheme === 'dark' ? '#ffb2ba' : '#ffb2ba';
  const ringDangerTo = palette.colorScheme === 'dark' ? '#dc2626' : '#dc2626';
  const ringOverdueFrom = palette.colorScheme === 'dark' ? '#c89a9a' : '#d8b3b3';
  const ringOverdueTo = palette.colorScheme === 'dark' ? '#f0d7d7' : '#9f5a5a';
  const selectedRowBg = palette.colorScheme === 'dark'
    ? alphaHex(palette.accent, 0.12)
    : alphaHex(palette.accent, isSolidLightTheme ? 0.03 : 0.06);
  const selectedRowBorder = palette.colorScheme === 'dark'
    ? alphaHex(palette.accent, 0.20)
    : alphaHex(palette.accent, isSolidLightTheme ? 0.08 : 0.12);
  const rowHover = palette.glass
    ? alphaHex(palette.surface, 0.84)
    : palette.colorScheme === 'dark'
      ? mixHex(palette.surface, '#ffffff', 0.04)
      : isSolidLightTheme
        ? '#f8fafc'
        : surfaceHover;

  return {
    appBackground: palette.background,
    appBackgroundColor: palette.backgroundColor,
    surface: palette.glass ? alphaHex(palette.surface, 0.64) : palette.surface,
    surfaceMuted,
    surfaceSubtle,
    surfaceHover,
    surfaceElevated,
    border,
    borderStrong,
    text: palette.text,
    textMuted,
    textSoft,
    accent: palette.accent,
    accentHover,
    accentSoft,
    accentContrast: getAccentContrast(palette.accent),
    inputBackground,
    chip,
    chipText,
    chipIdleBg,
    chipIdleText,
    chipIdleIcon,
    chipActive,
    chipActiveText,
    chipActiveIcon,
    chipActiveBorder,
    chipPausedBg,
    chipPausedText,
    chipPausedIcon,
    chipWarning,
    chipWarningText,
    chipWarningBorder,
    chipDanger,
    chipDangerText,
    chipZeroBg,
    chipZeroText,
    chipZeroBorder,
    chipOverdueBg,
    chipOverdueText,
    ringTrack,
    ringNormalFrom,
    ringNormalTo,
    ringRunningFrom,
    ringRunningTo,
    ringPausedFrom,
    ringPausedTo,
    ringZeroFrom,
    ringZeroTo,
    ringWarnFrom,
    ringWarnTo,
    ringDangerFrom,
    ringDangerTo,
    ringOverdueFrom,
    ringOverdueTo,
    selectedRowBg,
    selectedRowBorder,
    rowHover,
    overlay: palette.colorScheme === 'dark' ? 'rgba(2, 6, 23, 0.62)' : 'rgba(15, 23, 42, 0.14)',
    shadow: palette.glass
      ? '0 18px 60px rgba(84, 102, 171, 0.24)'
      : palette.colorScheme === 'dark'
        ? '0 18px 60px rgba(0, 0, 0, 0.42)'
        : '0 8px 24px rgba(15, 23, 42, 0.04)',
    shadowSoft: palette.colorScheme === 'dark' ? '0 1px 2px rgba(0, 0, 0, 0.24)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
    ring: alphaHex(palette.accent, palette.colorScheme === 'dark' ? 0.36 : isSolidLightTheme ? 0.15 : 0.36),
    isGlass: palette.glass,
    colorScheme: palette.colorScheme,
  };
}

const THEME_VARIABLE_NAMES = {
  background: '--background',
  foreground: '--foreground',
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
} as const;

export function applyThemeToDocument(
  mode: ThemeMode,
  customTheme: CustomThemeSettings = DEFAULT_CUSTOM_THEME_SETTINGS,
  doc: Document = document,
): ThemeTokens {
  const safeCustomTheme = normalizeCustomThemeSettings(customTheme);
  const tokens = resolveThemeTokens(mode, safeCustomTheme);
  const root = doc.documentElement;

  root.dataset.themeMode = mode;
  root.dataset.themePreset = mode === 'custom' ? safeCustomTheme.presetId : mode;
  root.dataset.themeSurface = tokens.isGlass ? 'glass' : 'solid';
  root.style.colorScheme = tokens.colorScheme;

  root.style.setProperty(THEME_VARIABLE_NAMES.background, tokens.appBackground);
  root.style.setProperty(THEME_VARIABLE_NAMES.foreground, tokens.text);
  root.style.setProperty(THEME_VARIABLE_NAMES.appBackground, tokens.appBackground);
  root.style.setProperty(THEME_VARIABLE_NAMES.appBackgroundColor, tokens.appBackgroundColor);
  root.style.setProperty(THEME_VARIABLE_NAMES.surface, tokens.surface);
  root.style.setProperty(THEME_VARIABLE_NAMES.surfaceMuted, tokens.surfaceMuted);
  root.style.setProperty(THEME_VARIABLE_NAMES.surfaceSubtle, tokens.surfaceSubtle);
  root.style.setProperty(THEME_VARIABLE_NAMES.surfaceHover, tokens.surfaceHover);
  root.style.setProperty(THEME_VARIABLE_NAMES.surfaceElevated, tokens.surfaceElevated);
  root.style.setProperty(THEME_VARIABLE_NAMES.border, tokens.border);
  root.style.setProperty(THEME_VARIABLE_NAMES.borderStrong, tokens.borderStrong);
  root.style.setProperty(THEME_VARIABLE_NAMES.text, tokens.text);
  root.style.setProperty(THEME_VARIABLE_NAMES.textMuted, tokens.textMuted);
  root.style.setProperty(THEME_VARIABLE_NAMES.textSoft, tokens.textSoft);
  root.style.setProperty(THEME_VARIABLE_NAMES.accent, tokens.accent);
  root.style.setProperty(THEME_VARIABLE_NAMES.accentHover, tokens.accentHover);
  root.style.setProperty(THEME_VARIABLE_NAMES.accentSoft, tokens.accentSoft);
  root.style.setProperty(THEME_VARIABLE_NAMES.accentContrast, tokens.accentContrast);
  root.style.setProperty(THEME_VARIABLE_NAMES.inputBackground, tokens.inputBackground);
  root.style.setProperty(THEME_VARIABLE_NAMES.chip, tokens.chip);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipText, tokens.chipText);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipIdleBg, tokens.chipIdleBg);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipIdleText, tokens.chipIdleText);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipIdleIcon, tokens.chipIdleIcon);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipActive, tokens.chipActive);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipActiveText, tokens.chipActiveText);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipActiveIcon, tokens.chipActiveIcon);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipActiveBorder, tokens.chipActiveBorder);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipPausedBg, tokens.chipPausedBg);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipPausedText, tokens.chipPausedText);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipPausedIcon, tokens.chipPausedIcon);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipWarning, tokens.chipWarning);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipWarningText, tokens.chipWarningText);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipWarningBorder, tokens.chipWarningBorder);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipDanger, tokens.chipDanger);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipDangerText, tokens.chipDangerText);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipZeroBg, tokens.chipZeroBg);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipZeroText, tokens.chipZeroText);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipZeroBorder, tokens.chipZeroBorder);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipOverdueBg, tokens.chipOverdueBg);
  root.style.setProperty(THEME_VARIABLE_NAMES.chipOverdueText, tokens.chipOverdueText);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringTrack, tokens.ringTrack);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringNormalFrom, tokens.ringNormalFrom);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringNormalTo, tokens.ringNormalTo);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringRunningFrom, tokens.ringRunningFrom);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringRunningTo, tokens.ringRunningTo);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringPausedFrom, tokens.ringPausedFrom);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringPausedTo, tokens.ringPausedTo);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringZeroFrom, tokens.ringZeroFrom);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringZeroTo, tokens.ringZeroTo);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringWarnFrom, tokens.ringWarnFrom);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringWarnTo, tokens.ringWarnTo);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringDangerFrom, tokens.ringDangerFrom);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringDangerTo, tokens.ringDangerTo);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringOverdueFrom, tokens.ringOverdueFrom);
  root.style.setProperty(THEME_VARIABLE_NAMES.ringOverdueTo, tokens.ringOverdueTo);
  root.style.setProperty(THEME_VARIABLE_NAMES.selectedRowBg, tokens.selectedRowBg);
  root.style.setProperty(THEME_VARIABLE_NAMES.selectedRowBorder, tokens.selectedRowBorder);
  root.style.setProperty(THEME_VARIABLE_NAMES.rowHover, tokens.rowHover);
  root.style.setProperty(THEME_VARIABLE_NAMES.overlay, tokens.overlay);
  root.style.setProperty(THEME_VARIABLE_NAMES.shadow, tokens.shadow);
  root.style.setProperty(THEME_VARIABLE_NAMES.shadowSoft, tokens.shadowSoft);
  root.style.setProperty(THEME_VARIABLE_NAMES.ring, tokens.ring);

  return tokens;
}

export function getThemeInitScript(storageKey: string): string {
  const payload = JSON.stringify({
    storageKey,
    defaultMode: 'light' satisfies ThemeMode,
    defaultCustomTheme: DEFAULT_CUSTOM_THEME_SETTINGS,
    presets: CUSTOM_THEME_PRESETS,
    lightTheme: LIGHT_THEME,
    darkTheme: DARK_THEME,
  });

  return `(() => {
    const DATA = ${payload};
    const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const normalizeHex = (value) => {
      if (typeof value !== 'string') return '';
      const trimmed = value.trim();
      if (!HEX_COLOR_RE.test(trimmed)) return '';
      if (trimmed.length === 4) {
        return ('#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3]).toLowerCase();
      }
      return trimmed.toLowerCase();
    };
    const hexToRgb = (hex) => {
      const normalized = normalizeHex(hex);
      if (!normalized) return { r: 0, g: 0, b: 0 };
      const value = normalized.slice(1);
      return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
      };
    };
    const rgbToHex = (r, g, b) => '#' + [r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('');
    const mixHex = (a, b, weight) => {
      const colorA = hexToRgb(a);
      const colorB = hexToRgb(b);
      const ratio = clamp(weight, 0, 1);
      return rgbToHex(
        colorA.r + (colorB.r - colorA.r) * ratio,
        colorA.g + (colorB.g - colorA.g) * ratio,
        colorA.b + (colorB.b - colorA.b) * ratio,
      );
    };
    const alphaHex = (hex, alpha) => {
      const rgb = hexToRgb(hex);
      return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + clamp(alpha, 0, 1).toFixed(3) + ')';
    };
    const darkenHex = (hex, amount) => mixHex(hex, '#000000', amount);
    const getAccentContrast = (hex) => {
      const rgb = hexToRgb(hex);
      const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
      return luminance > 0.56 ? '#0f172a' : '#ffffff';
    };
    const normalizeCustomTheme = (value) => {
      if (!value || typeof value !== 'object') return DATA.defaultCustomTheme;
      const presetId = DATA.presets.some((preset) => preset.id === value.presetId) ? value.presetId : DATA.defaultCustomTheme.presetId;
      const overrides = value.overrides && typeof value.overrides === 'object' ? value.overrides : {};
      return {
        presetId,
        overrides: {
          background: normalizeHex(overrides.background) || undefined,
          surface: normalizeHex(overrides.surface) || undefined,
          accent: normalizeHex(overrides.accent) || undefined,
          text: normalizeHex(overrides.text) || undefined,
          border: normalizeHex(overrides.border) || undefined,
        },
      };
    };
    const buildPalette = (mode, customTheme) => {
      if (mode === 'light') return DATA.lightTheme;
      if (mode === 'dark') return DATA.darkTheme;
      const preset = DATA.presets.find((item) => item.id === customTheme.presetId) || DATA.presets[0];
      return {
        ...preset,
        background: customTheme.overrides.background || preset.background,
        backgroundColor: customTheme.overrides.background || preset.backgroundColor,
        surface: customTheme.overrides.surface || preset.surface,
        accent: customTheme.overrides.accent || preset.accent,
        text: customTheme.overrides.text || preset.text,
        border: customTheme.overrides.border || preset.border,
      };
    };
    const buildTokens = (palette) => {
      const backgroundReference = palette.backgroundColor;
      const isSolidLightTheme = !palette.glass && palette.colorScheme === 'light';
      const surfaceMuted = palette.glass ? alphaHex(palette.surface, 0.46) : (isSolidLightTheme ? '#fcfdff' : mixHex(palette.surface, backgroundReference, 0.12));
      const surfaceSubtle = palette.glass ? alphaHex(palette.surface, 0.30) : (isSolidLightTheme ? '#f2f4f8' : mixHex(palette.surface, backgroundReference, 0.24));
      const surfaceHover = palette.glass ? alphaHex(palette.surface, 0.88) : (isSolidLightTheme ? '#f8fafc' : mixHex(palette.surface, palette.accent, 0.05));
      const surfaceElevated = palette.glass ? alphaHex(palette.surface, 0.74) : (palette.colorScheme === 'dark' ? mixHex(palette.surface, '#1f2937', 0.18) : (isSolidLightTheme ? '#ffffff' : palette.surface));
      const textMuted = isSolidLightTheme ? '#64748b' : mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.34 : 0.44);
      const textSoft = isSolidLightTheme ? '#94a3b8' : mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.54 : 0.62);
      const accentHover = isSolidLightTheme ? '#3f6ae0' : darkenHex(palette.accent, palette.colorScheme === 'dark' ? 0.08 : 0.14);
      const accentSoft = palette.glass ? alphaHex(palette.accent, 0.22) : (isSolidLightTheme ? '#e8f0ff' : alphaHex(palette.accent, 0.16));
      const border = palette.glass ? alphaHex(palette.border, 0.60) : palette.border;
      const borderStrong = palette.glass ? alphaHex(palette.border, 0.84) : (isSolidLightTheme ? '#d7dee7' : darkenHex(palette.border, palette.colorScheme === 'dark' ? 0.05 : 0.08));
      const inputBackground = palette.glass ? alphaHex(palette.surface, 0.58) : (isSolidLightTheme ? '#ffffff' : mixHex(palette.surface, backgroundReference, 0.08));
      const chip = palette.colorScheme === 'dark' ? alphaHex('#94a3b8', 0.14) : (isSolidLightTheme ? '#f1f5f9' : mixHex(palette.surface, backgroundReference, 0.22));
      const chipText = palette.colorScheme === 'dark' ? mixHex(palette.text, '#94a3b8', 0.22) : (isSolidLightTheme ? '#334155' : textMuted);
      const chipIdleBg = palette.colorScheme === 'dark' ? alphaHex('#94a3b8', 0.08) : (isSolidLightTheme ? '#f8fafc' : surfaceHover);
      const chipIdleText = palette.colorScheme === 'dark' ? mixHex(palette.text, '#94a3b8', 0.28) : (isSolidLightTheme ? '#475569' : textMuted);
      const chipIdleIcon = palette.colorScheme === 'dark' ? mixHex(palette.text, backgroundReference, 0.54) : (isSolidLightTheme ? '#94a3b8' : textSoft);
      const chipActive = palette.colorScheme === 'dark' ? alphaHex(palette.accent, 0.22) : (isSolidLightTheme ? '#e8f0ff' : accentSoft);
      const chipActiveText = palette.colorScheme === 'dark' ? mixHex(palette.accent, '#ffffff', 0.18) : (isSolidLightTheme ? '#3b5ccc' : palette.accent);
      const chipActiveIcon = palette.colorScheme === 'dark' ? mixHex(palette.accent, '#ffffff', 0.12) : (isSolidLightTheme ? '#5b7cf6' : palette.accent);
      const chipActiveBorder = palette.colorScheme === 'dark' ? alphaHex(palette.accent, 0.20) : alphaHex(palette.accent, 0.10);
      const chipPausedBg = palette.colorScheme === 'dark' ? alphaHex('#94a3b8', 0.18) : '#e5eaf2';
      const chipPausedText = palette.colorScheme === 'dark' ? mixHex(palette.text, '#94a3b8', 0.26) : '#475569';
      const chipPausedIcon = palette.colorScheme === 'dark' ? mixHex(palette.text, '#94a3b8', 0.38) : '#64748b';
      const chipWarning = palette.colorScheme === 'dark' ? alphaHex('#e4d468', 0.22) : 'rgba(241, 225, 123, 0.18)';
      const chipWarningText = palette.colorScheme === 'dark' ? '#f2e58a' : '#8a741f';
      const chipWarningBorder = palette.colorScheme === 'dark' ? alphaHex('#e4d468', 0.30) : 'rgba(221, 198, 82, 0.24)';
      const chipDanger = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.16) : '#fff1f1';
      const chipDangerText = palette.colorScheme === 'dark' ? '#fca5a5' : '#a74f4f';
      const chipZeroBg = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.18) : 'rgba(239, 68, 68, 0.14)';
      const chipZeroText = palette.colorScheme === 'dark' ? '#f87171' : '#dc2626';
      const chipZeroBorder = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.30) : 'rgba(239, 68, 68, 0.24)';
      const chipOverdueBg = palette.colorScheme === 'dark' ? alphaHex('#ef4444', 0.14) : 'rgba(239, 68, 68, 0.10)';
      const chipOverdueText = palette.colorScheme === 'dark' ? '#f87171' : '#b91c1c';
      const ringTrack = palette.colorScheme === 'dark' ? mixHex(palette.border, '#ffffff', 0.08) : (isSolidLightTheme ? '#e6eaf0' : border);
      const ringNormalFrom = palette.colorScheme === 'dark' ? mixHex(palette.accent, '#ffffff', 0.22) : (isSolidLightTheme ? '#d8e5ff' : mixHex(palette.accent, '#ffffff', 0.56));
      const ringNormalTo = palette.colorScheme === 'dark' ? palette.accent : (isSolidLightTheme ? '#7fa6f6' : palette.accent);
      const ringRunningFrom = palette.colorScheme === 'dark' ? mixHex(palette.accent, '#ffffff', 0.28) : '#b2c2ff';
      const ringRunningTo = palette.colorScheme === 'dark' ? palette.accent : '#5b7cf6';
      const ringPausedFrom = palette.colorScheme === 'dark' ? mixHex('#94a3b8', '#ffffff', 0.16) : '#d1d9e4';
      const ringPausedTo = palette.colorScheme === 'dark' ? mixHex('#94a3b8', backgroundReference, 0.18) : '#9ca9ba';
      const ringZeroFrom = palette.colorScheme === 'dark' ? '#ffb2ba' : '#ffb2ba';
      const ringZeroTo = palette.colorScheme === 'dark' ? '#dc2626' : '#dc2626';
      const ringWarnFrom = palette.colorScheme === 'dark' ? '#f3e88f' : '#f6efb8';
      const ringWarnTo = palette.colorScheme === 'dark' ? '#d8c246' : '#ddc652';
      const ringDangerFrom = palette.colorScheme === 'dark' ? '#ffb2ba' : '#ffb2ba';
      const ringDangerTo = palette.colorScheme === 'dark' ? '#dc2626' : '#dc2626';
      const ringOverdueFrom = palette.colorScheme === 'dark' ? '#c89a9a' : '#d8b3b3';
      const ringOverdueTo = palette.colorScheme === 'dark' ? '#f0d7d7' : '#9f5a5a';
      const selectedRowBg = palette.colorScheme === 'dark'
        ? alphaHex(palette.accent, 0.12)
        : alphaHex(palette.accent, isSolidLightTheme ? 0.03 : 0.06);
      const selectedRowBorder = palette.colorScheme === 'dark'
        ? alphaHex(palette.accent, 0.20)
        : alphaHex(palette.accent, isSolidLightTheme ? 0.08 : 0.12);
      const rowHover = palette.glass ? alphaHex(palette.surface, 0.84) : (palette.colorScheme === 'dark' ? mixHex(palette.surface, '#ffffff', 0.04) : (isSolidLightTheme ? '#f8fafc' : surfaceHover));
      return {
        appBackground: palette.background,
        appBackgroundColor: palette.backgroundColor,
        surface: palette.glass ? alphaHex(palette.surface, 0.64) : palette.surface,
        surfaceMuted,
        surfaceSubtle,
        surfaceHover,
        surfaceElevated,
        border,
        borderStrong,
        text: palette.text,
        textMuted,
        textSoft,
        accent: palette.accent,
        accentHover,
        accentSoft,
        accentContrast: getAccentContrast(palette.accent),
        inputBackground,
        chip,
        chipText,
        chipIdleBg,
        chipIdleText,
        chipIdleIcon,
        chipActive,
        chipActiveText,
        chipActiveIcon,
        chipActiveBorder,
        chipPausedBg,
        chipPausedText,
        chipPausedIcon,
        chipWarning,
        chipWarningText,
        chipWarningBorder,
        chipDanger,
        chipDangerText,
        chipZeroBg,
        chipZeroText,
        chipZeroBorder,
        chipOverdueBg,
        chipOverdueText,
        ringTrack,
        ringNormalFrom,
        ringNormalTo,
        ringRunningFrom,
        ringRunningTo,
        ringPausedFrom,
        ringPausedTo,
        ringZeroFrom,
        ringZeroTo,
        ringWarnFrom,
        ringWarnTo,
        ringDangerFrom,
        ringDangerTo,
        ringOverdueFrom,
        ringOverdueTo,
        selectedRowBg,
        selectedRowBorder,
        rowHover,
        overlay: palette.colorScheme === 'dark' ? 'rgba(2, 6, 23, 0.62)' : 'rgba(15, 23, 42, 0.14)',
        shadow: palette.glass ? '0 18px 60px rgba(84, 102, 171, 0.24)' : (palette.colorScheme === 'dark' ? '0 18px 60px rgba(0, 0, 0, 0.42)' : '0 8px 24px rgba(15, 23, 42, 0.04)'),
        shadowSoft: palette.colorScheme === 'dark' ? '0 1px 2px rgba(0, 0, 0, 0.24)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
        ring: alphaHex(palette.accent, palette.colorScheme === 'dark' ? 0.36 : (isSolidLightTheme ? 0.15 : 0.36)),
        isGlass: palette.glass,
        colorScheme: palette.colorScheme,
      };
    };
    try {
      const stored = window.localStorage.getItem(DATA.storageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      const appearance = parsed && typeof parsed === 'object' && parsed.appearance && typeof parsed.appearance === 'object' ? parsed.appearance : {};
      const mode = appearance.themeMode === 'light' || appearance.themeMode === 'dark' || appearance.themeMode === 'custom'
        ? appearance.themeMode
        : DATA.defaultMode;
      const customTheme = normalizeCustomTheme(appearance.customTheme);
      const palette = buildPalette(mode, customTheme);
      const tokens = buildTokens(palette);
      const root = document.documentElement;
      root.dataset.themeMode = mode;
      root.dataset.themePreset = mode === 'custom' ? customTheme.presetId : mode;
      root.dataset.themeSurface = tokens.isGlass ? 'glass' : 'solid';
      root.style.colorScheme = tokens.colorScheme;
      root.style.setProperty('--background', tokens.appBackground);
      root.style.setProperty('--foreground', tokens.text);
      root.style.setProperty('--tt-app-bg', tokens.appBackground);
      root.style.setProperty('--tt-app-bg-color', tokens.appBackgroundColor);
      root.style.setProperty('--tt-surface', tokens.surface);
      root.style.setProperty('--tt-surface-muted', tokens.surfaceMuted);
      root.style.setProperty('--tt-surface-subtle', tokens.surfaceSubtle);
      root.style.setProperty('--tt-surface-hover', tokens.surfaceHover);
      root.style.setProperty('--tt-surface-elevated', tokens.surfaceElevated);
      root.style.setProperty('--tt-border', tokens.border);
      root.style.setProperty('--tt-border-strong', tokens.borderStrong);
      root.style.setProperty('--tt-text', tokens.text);
      root.style.setProperty('--tt-text-muted', tokens.textMuted);
      root.style.setProperty('--tt-text-soft', tokens.textSoft);
      root.style.setProperty('--tt-accent', tokens.accent);
      root.style.setProperty('--tt-accent-hover', tokens.accentHover);
      root.style.setProperty('--tt-accent-soft', tokens.accentSoft);
      root.style.setProperty('--tt-accent-contrast', tokens.accentContrast);
      root.style.setProperty('--tt-input-bg', tokens.inputBackground);
      root.style.setProperty('--tt-chip-bg', tokens.chip);
      root.style.setProperty('--tt-chip-text', tokens.chipText);
      root.style.setProperty('--tt-chip-idle-bg', tokens.chipIdleBg);
      root.style.setProperty('--tt-chip-idle-text', tokens.chipIdleText);
      root.style.setProperty('--tt-chip-idle-icon', tokens.chipIdleIcon);
      root.style.setProperty('--tt-chip-active-bg', tokens.chipActive);
      root.style.setProperty('--tt-chip-active-text', tokens.chipActiveText);
      root.style.setProperty('--tt-chip-active-icon', tokens.chipActiveIcon);
      root.style.setProperty('--tt-chip-active-border', tokens.chipActiveBorder);
      root.style.setProperty('--tt-chip-paused-bg', tokens.chipPausedBg);
      root.style.setProperty('--tt-chip-paused-text', tokens.chipPausedText);
      root.style.setProperty('--tt-chip-paused-icon', tokens.chipPausedIcon);
      root.style.setProperty('--tt-chip-warning-bg', tokens.chipWarning);
      root.style.setProperty('--tt-chip-warning-text', tokens.chipWarningText);
      root.style.setProperty('--tt-chip-warning-border', tokens.chipWarningBorder);
      root.style.setProperty('--tt-chip-danger-bg', tokens.chipDanger);
      root.style.setProperty('--tt-chip-danger-text', tokens.chipDangerText);
      root.style.setProperty('--tt-chip-zero-bg', tokens.chipZeroBg);
      root.style.setProperty('--tt-chip-zero-text', tokens.chipZeroText);
      root.style.setProperty('--tt-chip-zero-border', tokens.chipZeroBorder);
      root.style.setProperty('--tt-chip-overdue-bg', tokens.chipOverdueBg);
      root.style.setProperty('--tt-chip-overdue-text', tokens.chipOverdueText);
      root.style.setProperty('--tt-ring-track', tokens.ringTrack);
      root.style.setProperty('--tt-ring-normal-from', tokens.ringNormalFrom);
      root.style.setProperty('--tt-ring-normal-to', tokens.ringNormalTo);
      root.style.setProperty('--tt-ring-running-from', tokens.ringRunningFrom);
      root.style.setProperty('--tt-ring-running-to', tokens.ringRunningTo);
      root.style.setProperty('--tt-ring-paused-from', tokens.ringPausedFrom);
      root.style.setProperty('--tt-ring-paused-to', tokens.ringPausedTo);
      root.style.setProperty('--tt-ring-zero-from', tokens.ringZeroFrom);
      root.style.setProperty('--tt-ring-zero-to', tokens.ringZeroTo);
      root.style.setProperty('--tt-ring-warn-from', tokens.ringWarnFrom);
      root.style.setProperty('--tt-ring-warn-to', tokens.ringWarnTo);
      root.style.setProperty('--tt-ring-danger-from', tokens.ringDangerFrom);
      root.style.setProperty('--tt-ring-danger-to', tokens.ringDangerTo);
      root.style.setProperty('--tt-ring-overdue-from', tokens.ringOverdueFrom);
      root.style.setProperty('--tt-ring-overdue-to', tokens.ringOverdueTo);
      root.style.setProperty('--tt-selected-row-bg', tokens.selectedRowBg);
      root.style.setProperty('--tt-selected-row-border', tokens.selectedRowBorder);
      root.style.setProperty('--tt-row-hover', tokens.rowHover);
      root.style.setProperty('--tt-overlay', tokens.overlay);
      root.style.setProperty('--tt-shadow', tokens.shadow);
      root.style.setProperty('--tt-shadow-soft', tokens.shadowSoft);
      root.style.setProperty('--tt-ring', tokens.ring);
    } catch (error) {
      const root = document.documentElement;
      root.dataset.themeMode = DATA.defaultMode;
      root.dataset.themePreset = DATA.defaultMode;
      root.dataset.themeSurface = 'solid';
      root.style.colorScheme = 'light';
    }
  })();`;
}
