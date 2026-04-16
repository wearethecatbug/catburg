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

export interface ThemePalette {
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
  chipPausedBorder: string;
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

