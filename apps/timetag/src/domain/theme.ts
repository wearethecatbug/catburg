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
  overlay: string;
  shadow: string;
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
  background: '#f3f6fb',
  backgroundColor: '#f3f6fb',
  surface: '#ffffff',
  accent: '#2563eb',
  text: '#172033',
  border: '#d6deea',
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
  const surfaceMuted = palette.glass ? alphaHex(palette.surface, 0.46) : mixHex(palette.surface, backgroundReference, 0.12);
  const surfaceSubtle = palette.glass ? alphaHex(palette.surface, 0.30) : mixHex(palette.surface, backgroundReference, 0.24);
  const surfaceHover = palette.glass ? alphaHex(palette.surface, 0.88) : mixHex(palette.surface, palette.accent, 0.05);
  const surfaceElevated = palette.glass
    ? alphaHex(palette.surface, 0.74)
    : palette.colorScheme === 'dark'
      ? mixHex(palette.surface, '#1f2937', 0.18)
      : palette.surface;
  const textMuted = mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.34 : 0.44);
  const textSoft = mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.54 : 0.62);
  const accentHover = darkenHex(palette.accent, palette.colorScheme === 'dark' ? 0.08 : 0.14);
  const accentSoft = alphaHex(palette.accent, palette.glass ? 0.22 : 0.16);
  const border = palette.glass ? alphaHex(palette.border, 0.60) : palette.border;
  const borderStrong = palette.glass ? alphaHex(palette.border, 0.84) : darkenHex(palette.border, palette.colorScheme === 'dark' ? 0.05 : 0.08);
  const inputBackground = palette.glass ? alphaHex(palette.surface, 0.58) : mixHex(palette.surface, backgroundReference, 0.08);

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
    overlay: palette.colorScheme === 'dark' ? 'rgba(2, 6, 23, 0.62)' : 'rgba(15, 23, 42, 0.20)',
    shadow: palette.glass
      ? '0 18px 60px rgba(84, 102, 171, 0.24)'
      : palette.colorScheme === 'dark'
        ? '0 18px 60px rgba(0, 0, 0, 0.42)'
        : '0 18px 60px rgba(15, 23, 42, 0.14)',
    ring: alphaHex(palette.accent, 0.36),
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
  overlay: '--tt-overlay',
  shadow: '--tt-shadow',
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
  root.style.setProperty(THEME_VARIABLE_NAMES.overlay, tokens.overlay);
  root.style.setProperty(THEME_VARIABLE_NAMES.shadow, tokens.shadow);
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
      const surfaceMuted = palette.glass ? alphaHex(palette.surface, 0.46) : mixHex(palette.surface, backgroundReference, 0.12);
      const surfaceSubtle = palette.glass ? alphaHex(palette.surface, 0.30) : mixHex(palette.surface, backgroundReference, 0.24);
      const surfaceHover = palette.glass ? alphaHex(palette.surface, 0.88) : mixHex(palette.surface, palette.accent, 0.05);
      const surfaceElevated = palette.glass ? alphaHex(palette.surface, 0.74) : (palette.colorScheme === 'dark' ? mixHex(palette.surface, '#1f2937', 0.18) : palette.surface);
      const textMuted = mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.34 : 0.44);
      const textSoft = mixHex(palette.text, backgroundReference, palette.colorScheme === 'dark' ? 0.54 : 0.62);
      const accentHover = darkenHex(palette.accent, palette.colorScheme === 'dark' ? 0.08 : 0.14);
      const accentSoft = alphaHex(palette.accent, palette.glass ? 0.22 : 0.16);
      const border = palette.glass ? alphaHex(palette.border, 0.60) : palette.border;
      const borderStrong = palette.glass ? alphaHex(palette.border, 0.84) : darkenHex(palette.border, palette.colorScheme === 'dark' ? 0.05 : 0.08);
      const inputBackground = palette.glass ? alphaHex(palette.surface, 0.58) : mixHex(palette.surface, backgroundReference, 0.08);
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
        overlay: palette.colorScheme === 'dark' ? 'rgba(2, 6, 23, 0.62)' : 'rgba(15, 23, 42, 0.20)',
        shadow: palette.glass ? '0 18px 60px rgba(84, 102, 171, 0.24)' : (palette.colorScheme === 'dark' ? '0 18px 60px rgba(0, 0, 0, 0.42)' : '0 18px 60px rgba(15, 23, 42, 0.14)'),
        ring: alphaHex(palette.accent, 0.36),
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
      root.style.setProperty('--tt-overlay', tokens.overlay);
      root.style.setProperty('--tt-shadow', tokens.shadow);
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
