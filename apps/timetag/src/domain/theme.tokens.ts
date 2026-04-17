import { alphaHex, darkenHex, getAccentContrast, mixHex } from './theme.colors';
import { buildThemePalette, normalizeCustomThemeSettings } from './theme.palette';
import { DEFAULT_CUSTOM_THEME_SETTINGS } from './theme.presets';
import type { CustomThemeSettings, ThemeMode, ThemePalette, ThemeTokens } from './theme.types';

type ThemeVariant = 'light' | 'dark' | 'glass';

interface ThemeTokenContext {
  palette: ThemePalette;
  backgroundReference: string;
  variant: ThemeVariant;
}

export function createThemeTokenContext(palette: ThemePalette): ThemeTokenContext {
  return {
    palette,
    backgroundReference: palette.backgroundColor,
    variant: palette.glass ? 'glass' : palette.colorScheme,
  };
}

export function buildSurfaceTokens(context: ThemeTokenContext): Pick<ThemeTokens, 'surface' | 'surfaceMuted' | 'surfaceSubtle' | 'surfaceHover' | 'surfaceElevated' | 'inputBackground' | 'border' | 'borderStrong'> {
  const { palette, backgroundReference, variant } = context;

  if (variant === 'glass') {
    return {
      surface: alphaHex(palette.surface, 0.64),
      surfaceMuted: alphaHex(palette.surface, 0.46),
      surfaceSubtle: alphaHex(palette.surface, 0.30),
      surfaceHover: alphaHex(palette.surface, 0.88),
      surfaceElevated: alphaHex(palette.surface, 0.74),
      inputBackground: alphaHex(palette.surface, 0.58),
      border: alphaHex(palette.border, 0.60),
      borderStrong: alphaHex(palette.border, 0.84),
    };
  }

  if (variant === 'light') {
    return {
      surface: palette.surface,
      surfaceMuted: '#fcfdff',
      surfaceSubtle: '#f2f4f8',
      surfaceHover: '#f8fafc',
      surfaceElevated: '#ffffff',
      inputBackground: '#ffffff',
      border: palette.border,
      borderStrong: '#d7dee7',
    };
  }

  return {
    surface: palette.surface,
    surfaceMuted: mixHex(palette.surface, backgroundReference, 0.12),
    surfaceSubtle: mixHex(palette.surface, backgroundReference, 0.24),
    surfaceHover: mixHex(palette.surface, palette.accent, 0.05),
    surfaceElevated: mixHex(palette.surface, '#1f2937', 0.18),
    inputBackground: mixHex(palette.surface, backgroundReference, 0.08),
    border: palette.border,
    borderStrong: darkenHex(palette.border, 0.05),
  };
}

export function buildTextTokens(context: ThemeTokenContext): Pick<ThemeTokens, 'text' | 'textMuted' | 'textSoft'> {
  const { palette, backgroundReference, variant } = context;

  if (variant === 'light') {
    return {
      text: palette.text,
      textMuted: '#64748b',
      textSoft: '#94a3b8',
    };
  }

  return {
    text: palette.text,
    textMuted: mixHex(palette.text, backgroundReference, variant === 'dark' ? 0.34 : 0.44),
    textSoft: mixHex(palette.text, backgroundReference, variant === 'dark' ? 0.54 : 0.62),
  };
}

export function buildAccentTokens(context: ThemeTokenContext): Pick<ThemeTokens, 'accent' | 'accentHover' | 'accentSoft' | 'accentContrast'> {
  const { palette, variant } = context;

  return {
    accent: palette.accent,
    accentHover: variant === 'light' ? '#3f6ae0' : darkenHex(palette.accent, variant === 'dark' ? 0.08 : 0.14),
    accentSoft: variant === 'glass'
      ? alphaHex(palette.accent, 0.22)
      : variant === 'light'
        ? '#e8f0ff'
        : alphaHex(palette.accent, 0.16),
    accentContrast: getAccentContrast(palette.accent),
  };
}

export function buildChipTokens(
  context: ThemeTokenContext,
  args: Pick<ThemeTokens, 'accent' | 'accentSoft' | 'text' | 'textMuted' | 'textSoft'>,
): Pick<ThemeTokens, 'chip' | 'chipText' | 'chipIdleBg' | 'chipIdleText' | 'chipIdleIcon' | 'chipActive' | 'chipActiveText' | 'chipActiveIcon' | 'chipActiveBorder' | 'chipPausedBg' | 'chipPausedText' | 'chipPausedIcon' | 'chipPausedBorder' | 'chipWarning' | 'chipWarningText' | 'chipWarningBorder' | 'chipDanger' | 'chipDangerText' | 'chipZeroBg' | 'chipZeroText' | 'chipZeroBorder' | 'chipOverdueBg' | 'chipOverdueText'> {
  const { palette, backgroundReference, variant } = context;
  const { accent, accentSoft, text, textMuted, textSoft } = args;

  if (variant === 'dark') {
    return {
      chip: alphaHex('#94a3b8', 0.14),
      chipText: mixHex(text, '#94a3b8', 0.22),
      chipIdleBg: alphaHex('#94a3b8', 0.08),
      chipIdleText: mixHex(text, '#94a3b8', 0.28),
      chipIdleIcon: mixHex(text, backgroundReference, 0.54),
      chipActive: alphaHex(accent, 0.22),
      chipActiveText: mixHex(accent, '#ffffff', 0.18),
      chipActiveIcon: mixHex(accent, '#ffffff', 0.12),
      chipActiveBorder: alphaHex(accent, 0.20),
      chipPausedBg: alphaHex('#94a3b8', 0.18),
      chipPausedText: mixHex(text, '#94a3b8', 0.26),
      chipPausedIcon: mixHex(text, '#94a3b8', 0.38),
      chipPausedBorder: alphaHex('#94a3b8', 0.24),
      chipWarning: alphaHex('#e4d468', 0.22),
      chipWarningText: '#f2e58a',
      chipWarningBorder: alphaHex('#e4d468', 0.30),
      chipDanger: alphaHex('#ef4444', 0.16),
      chipDangerText: '#fca5a5',
      chipZeroBg: alphaHex('#ef4444', 0.18),
      chipZeroText: '#f87171',
      chipZeroBorder: alphaHex('#ef4444', 0.30),
      chipOverdueBg: alphaHex('#ef4444', 0.14),
      chipOverdueText: '#f87171',
    };
  }

  if (variant === 'light') {
    return {
      chip: '#f1f5f9',
      chipText: '#334155',
      chipIdleBg: '#f8fafc',
      chipIdleText: '#475569',
      chipIdleIcon: '#94a3b8',
      chipActive: '#e8f0ff',
      chipActiveText: '#3b5ccc',
      chipActiveIcon: '#5b7cf6',
      chipActiveBorder: alphaHex(accent, 0.10),
      chipPausedBg: '#e5eaf2',
      chipPausedText: '#475569',
      chipPausedIcon: '#64748b',
      chipPausedBorder: 'rgba(148, 163, 184, 0.16)',
      chipWarning: 'rgba(241, 225, 123, 0.18)',
      chipWarningText: '#8a741f',
      chipWarningBorder: 'rgba(221, 198, 82, 0.24)',
      chipDanger: '#fff1f1',
      chipDangerText: '#a74f4f',
      chipZeroBg: 'rgba(239, 68, 68, 0.14)',
      chipZeroText: '#dc2626',
      chipZeroBorder: 'rgba(239, 68, 68, 0.24)',
      chipOverdueBg: 'rgba(239, 68, 68, 0.10)',
      chipOverdueText: '#b91c1c',
    };
  }

  return {
    chip: mixHex(palette.surface, backgroundReference, 0.22),
    chipText: textMuted,
    chipIdleBg: alphaHex(palette.surface, 0.88),
    chipIdleText: textMuted,
    chipIdleIcon: textSoft,
    chipActive: accentSoft,
    chipActiveText: accent,
    chipActiveIcon: accent,
    chipActiveBorder: alphaHex(accent, 0.10),
    chipPausedBg: '#e5eaf2',
    chipPausedText: '#475569',
    chipPausedIcon: '#64748b',
    chipPausedBorder: 'rgba(148, 163, 184, 0.16)',
    chipWarning: 'rgba(241, 225, 123, 0.18)',
    chipWarningText: '#8a741f',
    chipWarningBorder: 'rgba(221, 198, 82, 0.24)',
    chipDanger: '#fff1f1',
    chipDangerText: '#a74f4f',
    chipZeroBg: 'rgba(239, 68, 68, 0.14)',
    chipZeroText: '#dc2626',
    chipZeroBorder: 'rgba(239, 68, 68, 0.24)',
    chipOverdueBg: 'rgba(239, 68, 68, 0.10)',
    chipOverdueText: '#b91c1c',
  };
}

export function buildPriorityTokens(
  context: ThemeTokenContext,
  args: Pick<ThemeTokens, 'textSoft'>,
): Pick<ThemeTokens, 'priorityUrgentBar' | 'priorityUrgentBarBorder' | 'priorityUrgentBarGlow' | 'priorityDoneBar' | 'priorityDoneBarBorder'> {
  const { variant } = context;
  const { textSoft } = args;
  const mutedDoneBar = mixHex(textSoft, '#ffffff', variant === 'dark' ? 0.18 : 0.26);

  if (variant === 'dark') {
    return {
      priorityUrgentBar: mixHex('#ffe200', '#fff4a8', 0.22),
      priorityUrgentBarBorder: alphaHex('#d2be21', 0.18),
      priorityUrgentBarGlow: alphaHex('#ffe200', 0.10),
      priorityDoneBar: mutedDoneBar,
      priorityDoneBarBorder: alphaHex(mutedDoneBar, 0.14),
    };
  }

  if (variant === 'light') {
    return {
      priorityUrgentBar: '#ffe200',
      priorityUrgentBarBorder: alphaHex('#d2be21', 0.16),
      priorityUrgentBarGlow: alphaHex('#ffe200', 0.08),
      priorityDoneBar: mutedDoneBar,
      priorityDoneBarBorder: alphaHex(mutedDoneBar, 0.14),
    };
  }

  return {
    priorityUrgentBar: '#ffe200',
    priorityUrgentBarBorder: alphaHex('#d2be21', 0.14),
    priorityUrgentBarGlow: alphaHex('#ffe200', 0.06),
    priorityDoneBar: mutedDoneBar,
    priorityDoneBarBorder: alphaHex(mutedDoneBar, 0.12),
  };
}

export function buildRingTokens(
  context: ThemeTokenContext,
  args: Pick<ThemeTokens, 'border'>,
): Pick<ThemeTokens, 'ringTrack' | 'ringNormalFrom' | 'ringNormalTo' | 'ringRunningFrom' | 'ringRunningTo' | 'ringPausedFrom' | 'ringPausedTo' | 'ringZeroFrom' | 'ringZeroTo' | 'ringWarnFrom' | 'ringWarnTo' | 'ringDangerFrom' | 'ringDangerTo' | 'ringOverdueFrom' | 'ringOverdueTo' | 'ring'> {
  const { palette, variant } = context;
  const { border } = args;

  if (variant === 'dark') {
    return {
      ringTrack: mixHex(palette.border, '#ffffff', 0.08),
      ringNormalFrom: mixHex(palette.accent, '#ffffff', 0.22),
      ringNormalTo: palette.accent,
      ringRunningFrom: mixHex(palette.accent, '#ffffff', 0.28),
      ringRunningTo: palette.accent,
      ringPausedFrom: mixHex('#94a3b8', '#ffffff', 0.16),
      ringPausedTo: mixHex('#94a3b8', context.backgroundReference, 0.18),
      ringZeroFrom: '#ffb2ba',
      ringZeroTo: '#dc2626',
      ringWarnFrom: '#f3e88f',
      ringWarnTo: '#d8c246',
      ringDangerFrom: '#ffb2ba',
      ringDangerTo: '#dc2626',
      ringOverdueFrom: '#c89a9a',
      ringOverdueTo: '#f0d7d7',
      ring: alphaHex(palette.accent, 0.36),
    };
  }

  if (variant === 'light') {
    return {
      ringTrack: '#e6eaf0',
      ringNormalFrom: '#d8e5ff',
      ringNormalTo: '#7fa6f6',
      ringRunningFrom: '#b2c2ff',
      ringRunningTo: '#5b7cf6',
      ringPausedFrom: '#d1d9e4',
      ringPausedTo: '#9ca9ba',
      ringZeroFrom: '#ffb2ba',
      ringZeroTo: '#dc2626',
      ringWarnFrom: '#f6efb8',
      ringWarnTo: '#ddc652',
      ringDangerFrom: '#ffb2ba',
      ringDangerTo: '#dc2626',
      ringOverdueFrom: '#d8b3b3',
      ringOverdueTo: '#9f5a5a',
      ring: alphaHex(palette.accent, 0.15),
    };
  }

  return {
    ringTrack: border,
    ringNormalFrom: mixHex(palette.accent, '#ffffff', 0.56),
    ringNormalTo: palette.accent,
    ringRunningFrom: '#b2c2ff',
    ringRunningTo: '#5b7cf6',
    ringPausedFrom: '#d1d9e4',
    ringPausedTo: '#9ca9ba',
    ringZeroFrom: '#ffb2ba',
    ringZeroTo: '#dc2626',
    ringWarnFrom: '#f6efb8',
    ringWarnTo: '#ddc652',
    ringDangerFrom: '#ffb2ba',
    ringDangerTo: '#dc2626',
    ringOverdueFrom: '#d8b3b3',
    ringOverdueTo: '#9f5a5a',
    ring: alphaHex(palette.accent, 0.36),
  };
}

export function buildSelectionTokens(
  context: ThemeTokenContext,
  _args: Pick<ThemeTokens, 'surfaceHover'>,
): Pick<ThemeTokens, 'selectedRowBg' | 'selectedRowBorder' | 'rowHover' | 'overlay'> {
  const { palette, variant } = context;

  if (variant === 'dark') {
    return {
      selectedRowBg: alphaHex(palette.accent, 0.12),
      selectedRowBorder: alphaHex(palette.accent, 0.20),
      rowHover: mixHex(palette.surface, '#ffffff', 0.04),
      overlay: 'rgba(2, 6, 23, 0.62)',
    };
  }

  if (variant === 'light') {
    return {
      selectedRowBg: alphaHex(palette.accent, 0.03),
      selectedRowBorder: alphaHex(palette.accent, 0.08),
      rowHover: '#f8fafc',
      overlay: 'rgba(15, 23, 42, 0.14)',
    };
  }

  return {
    selectedRowBg: alphaHex(palette.accent, 0.06),
    selectedRowBorder: alphaHex(palette.accent, 0.12),
    rowHover: alphaHex(palette.surface, 0.84),
    overlay: 'rgba(15, 23, 42, 0.14)',
  };
}

export function buildShadowTokens(context: ThemeTokenContext): Pick<ThemeTokens, 'shadow' | 'shadowSoft'> {
  const { variant } = context;

  if (variant === 'glass') {
    return {
      shadow: '0 18px 60px rgba(84, 102, 171, 0.24)',
      shadowSoft: '0 1px 2px rgba(15, 23, 42, 0.04)',
    };
  }

  if (variant === 'dark') {
    return {
      shadow: '0 18px 60px rgba(0, 0, 0, 0.42)',
      shadowSoft: '0 1px 2px rgba(0, 0, 0, 0.24)',
    };
  }

  return {
    shadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
    shadowSoft: '0 1px 2px rgba(15, 23, 42, 0.04)',
  };
}

export function resolveThemeTokens(
  mode: ThemeMode,
  customTheme: CustomThemeSettings = DEFAULT_CUSTOM_THEME_SETTINGS,
): ThemeTokens {
  const palette = buildThemePalette(mode, normalizeCustomThemeSettings(customTheme));
  const context = createThemeTokenContext(palette);
  const surfaceTokens = buildSurfaceTokens(context);
  const textTokens = buildTextTokens(context);
  const accentTokens = buildAccentTokens(context);
  const chipTokens = buildChipTokens(context, {
    accent: accentTokens.accent,
    accentSoft: accentTokens.accentSoft,
    text: textTokens.text,
    textMuted: textTokens.textMuted,
    textSoft: textTokens.textSoft,
  });
  const priorityTokens = buildPriorityTokens(context, {
    textSoft: textTokens.textSoft,
  });
  const ringTokens = buildRingTokens(context, { border: surfaceTokens.border });
  const selectionTokens = buildSelectionTokens(context, { surfaceHover: surfaceTokens.surfaceHover });
  const shadowTokens = buildShadowTokens(context);

  return {
    appBackground: palette.background,
    appBackgroundColor: palette.backgroundColor,
    ...surfaceTokens,
    ...textTokens,
    ...accentTokens,
    ...chipTokens,
    ...priorityTokens,
    ...ringTokens,
    ...selectionTokens,
    ...shadowTokens,
    isGlass: palette.glass,
    colorScheme: palette.colorScheme,
  };
}




