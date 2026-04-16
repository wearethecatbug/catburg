import type {
  CustomThemePresetId,
  CustomThemeSettings,
  ThemeMode,
  ThemePalette,
  ThemePreset,
} from './theme.types';

export const LIGHT_THEME: ThemePalette = {
  background: '#f6f8fb',
  backgroundColor: '#f6f8fb',
  surface: '#ffffff',
  accent: '#4f7df3',
  text: '#1e293b',
  border: '#e6eaf0',
  glass: false,
  colorScheme: 'light',
};

export const DARK_THEME: ThemePalette = {
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

