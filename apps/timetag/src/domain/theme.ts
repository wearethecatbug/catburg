export type {
  CustomThemeOverrides,
  CustomThemePresetId,
  CustomThemeSettings,
  ThemeMode,
  ThemePalette,
  ThemePreset,
  ThemeTokens,
} from './theme.types';

export {
  CUSTOM_THEME_PRESETS,
  DARK_THEME,
  DEFAULT_CUSTOM_THEME_SETTINGS,
  getCustomThemePresetById,
  getNextThemeMode,
  getThemeModeLabel,
  isCustomThemePresetId,
  isThemeMode,
  LIGHT_THEME,
} from './theme.presets';

export {
  alphaHex,
  clamp,
  darkenHex,
  getAccentContrast,
  hexToRgb,
  mixHex,
  normalizeHex,
  rgbToHex,
} from './theme.colors';

export {
  buildThemePalette,
  normalizeCustomThemeSettings,
  normalizeOptionalHex,
  type ThemeBootstrapPayload,
} from './theme.palette';

export {
  buildAccentTokens,
  buildChipTokens,
  buildRingTokens,
  buildSelectionTokens,
  buildShadowTokens,
  buildSurfaceTokens,
  buildTextTokens,
  createThemeTokenContext,
  resolveThemeTokens,
} from './theme.tokens';

export {
  applyThemeToDocument,
  applyThemeTokensToRoot,
  THEME_ALIAS_VARIABLES,
  THEME_TOKEN_CSS_VARIABLES,
  type ThemeCssVarTokenKey,
} from './theme.css-vars';

export { getThemeInitScript } from './theme.init-script';
