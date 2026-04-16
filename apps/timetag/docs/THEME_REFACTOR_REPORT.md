# Theme refactor report

## Scope

Refactor target:
- `src/domain/theme.ts`
- `src/app/ThemeController.tsx`
- theme pre-hydration initialization used from `src/app/layout.tsx`

Goal:
- preserve current behavior
- keep theme logic centralized in the domain layer
- split the overloaded theme god-file into focused modules
- reduce duplication between runtime theme resolution and pre-hydration script setup
- keep `ThemeController` orchestration-only

## Architectural analysis

The previous `src/domain/theme.ts` mixed too many responsibilities in one file:

1. theme contracts and types
2. presets and defaults
3. color math helpers
4. palette resolution
5. token generation
6. CSS variable mapping
7. DOM application side effects
8. pre-hydration init script generation

This made the file hard to reason about and risky to extend with future presets.

## Corrections applied to the proposed structure

The suggested structure was largely correct, but two corrections were important:

### 1. Keep theme side-effect orchestration in domain support modules, not in UI
`ThemeController` remains thin and unchanged in responsibility.
It still only reacts to hydrated settings and triggers theme application.

The actual theme logic remains centralized in domain files:
- `theme.css-vars.ts`
- `theme.init-script.ts`

This keeps the app layer orchestration-only.

### 2. Pre-hydration script cannot directly import runtime TS modules
A full elimination of inline-script duplication is not realistically possible because the browser boot script must run before the React app hydrates.

To reduce drift instead of duplicating the whole engine manually, the refactor now:
- centralizes presets/defaults as serialized data
- centralizes CSS variable mapping in a typed map
- reuses the same pure theme functions inside the init script by serializing their function source

This is a pragmatic reduction of duplication while keeping first-paint compatibility.

## New module structure

- `src/domain/theme.types.ts`
  - theme contracts and token/preset types
- `src/domain/theme.presets.ts`
  - built-in palettes, custom presets, defaults, theme mode helpers
- `src/domain/theme.colors.ts`
  - pure color conversion and mixing helpers
- `src/domain/theme.palette.ts`
  - custom theme normalization and palette construction
- `src/domain/theme.tokens.ts`
  - focused token builder functions and `resolveThemeTokens`
- `src/domain/theme.css-vars.ts`
  - typed token-to-css-variable map and DOM application helpers
- `src/domain/theme.init-script.ts`
  - pre-hydration bootstrap script generation
- `src/domain/theme.ts`
  - compatibility barrel that re-exports the public theme API

## Token builder split

`resolveThemeTokens` is now composed from smaller builders:

- surface tokens
- text tokens
- accent tokens
- chip tokens
- ring tokens
- selection/overlay tokens
- shadow tokens

This reduces the previous long chain of repeated dark / solid-light / glass ternary branches and makes future extension much easier.

## CSS variable application improvement

The previous `applyThemeToDocument` manually called `root.style.setProperty(...)` for every token.

Now this is driven by:
- `THEME_TOKEN_CSS_VARIABLES`
- `THEME_ALIAS_VARIABLES`

Benefits:
- typed mapping between tokens and CSS variables
- less repetitive code
- easier extension when new theme tokens are added

## Init script improvement

Previously the init script contained a large hand-written duplicate theme engine.

Now it is reduced by:
- serializing shared preset/default payloads
- serializing the typed CSS variable map
- serializing the same pure helper functions used by the runtime token engine

This significantly lowers drift risk between runtime and pre-hydration behavior while preserving hydration-safe theme setup.

## Compatibility impact

Public imports remain stable through `src/domain/theme.ts`, including:
- `applyThemeToDocument`
- `getThemeInitScript`
- `resolveThemeTokens`
- `normalizeCustomThemeSettings`
- `getThemeModeLabel`
- `getNextThemeMode`
- preset/default exports

This avoids forcing unrelated consumers to change.

## Behavior expectations

No intended user-facing behavior changes.

The refactor preserves:
- light / dark / custom mode behavior
- custom theme preset behavior
- settings-store integration
- pre-hydration theme initialization flow
- `ThemeController` orchestration role

## Validation performed

Run successfully:
- `pnpm lint`
- `pnpm build`

## globals.css fallback cleanup

After the module split, `src/app/globals.css` was also aligned with the new typed token map.

Applied cleanup:
- removed orphan `--tt-chip-warning-icon` because it is not present in `ThemeTokens` or the CSS variable map
- aligned light fallback values with current token outputs for:
  - `--tt-chip-active-bg`
  - `--tt-chip-active-text`
  - `--tt-ring-normal-from`
  - `--tt-ring-normal-to`
  - `--tt-ring-overdue-from`
  - `--tt-ring-overdue-to`
  - `--tt-selected-row-bg`
  - `--tt-selected-row-border`

This keeps the pre-init CSS fallback closer to the runtime light theme and reduces visual drift before hydration.

## Next possible improvements

If theme complexity grows later, the next safe steps would be:

1. add unit tests for token builders (`resolveThemeTokens`, palette normalization)
2. add visual regression coverage for light / dark / custom themes
3. normalize `globals.css` fallback variables against the token map automatically if the project adds theme testing infrastructure


