import {
  alphaHex,
  clamp,
  darkenHex,
  getAccentContrast,
  hexToRgb,
  mixHex,
  normalizeHex,
  rgbToHex,
} from './theme.colors';
import { THEME_ALIAS_VARIABLES, THEME_TOKEN_CSS_VARIABLES, applyThemeTokensToRoot } from './theme.css-vars';
import { buildThemePalette, normalizeCustomThemeSettings, normalizeOptionalHex } from './theme.palette';
import {
  CUSTOM_THEME_PRESETS,
  DARK_THEME,
  DEFAULT_CUSTOM_THEME_SETTINGS,
  LIGHT_THEME,
} from './theme.presets';
import {
  buildAccentTokens,
  buildChipTokens,
  buildPriorityTokens,
  buildRingTokens,
  buildSelectionTokens,
  buildShadowTokens,
  buildSurfaceTokens,
  buildTextTokens,
  createThemeTokenContext,
  resolveThemeTokens,
} from './theme.tokens';
import type { ThemeMode } from './theme.types';

type SerializableThemeFunction = (...args: never[]) => unknown;

function serializeFunction(fn: SerializableThemeFunction): string {
  return fn.toString();
}

export function getThemeInitScript(storageKey: string): string {
  const payload = JSON.stringify({
    storageKey,
    defaultMode: 'light' satisfies ThemeMode,
    defaultCustomTheme: DEFAULT_CUSTOM_THEME_SETTINGS,
    presets: CUSTOM_THEME_PRESETS,
    lightTheme: LIGHT_THEME,
    darkTheme: DARK_THEME,
    themeTokenCssVariables: THEME_TOKEN_CSS_VARIABLES,
    themeAliasVariables: THEME_ALIAS_VARIABLES,
  });

  const serializedFunctions = [
    clamp,
    normalizeHex,
    hexToRgb,
    rgbToHex,
    mixHex,
    alphaHex,
    darkenHex,
    getAccentContrast,
    normalizeOptionalHex,
    normalizeCustomThemeSettings,
    buildThemePalette,
    createThemeTokenContext,
    buildSurfaceTokens,
    buildTextTokens,
    buildAccentTokens,
    buildChipTokens,
    buildPriorityTokens,
    buildRingTokens,
    buildSelectionTokens,
    buildShadowTokens,
    resolveThemeTokens,
    applyThemeTokensToRoot,
  ].map(serializeFunction).join('\n\n');

  return `(() => {
    const DATA = ${payload};
    const DEFAULT_CUSTOM_THEME_SETTINGS = DATA.defaultCustomTheme;
    const CUSTOM_THEME_PRESETS = DATA.presets;
    const LIGHT_THEME = DATA.lightTheme;
    const DARK_THEME = DATA.darkTheme;
    const THEME_TOKEN_CSS_VARIABLES = DATA.themeTokenCssVariables;
    const THEME_ALIAS_VARIABLES = DATA.themeAliasVariables;

    ${serializedFunctions}

    try {
      const stored = window.localStorage.getItem(DATA.storageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      const appearance = parsed && typeof parsed === 'object' && parsed.appearance && typeof parsed.appearance === 'object'
        ? parsed.appearance
        : {};
      const mode = appearance.themeMode === 'light' || appearance.themeMode === 'dark' || appearance.themeMode === 'custom'
        ? appearance.themeMode
        : DATA.defaultMode;
      const safeCustomTheme = normalizeCustomThemeSettings(appearance.customTheme);
      const tokens = resolveThemeTokens(mode, safeCustomTheme);

      applyThemeTokensToRoot(document.documentElement, {
        mode,
        presetId: safeCustomTheme.presetId,
        tokens,
      });
    } catch (error) {
      const root = document.documentElement;
      root.dataset.themeMode = DATA.defaultMode;
      root.dataset.themePreset = DATA.defaultMode;
      root.dataset.themeSurface = 'solid';
      root.style.colorScheme = 'light';
    }
  })();`;
}


