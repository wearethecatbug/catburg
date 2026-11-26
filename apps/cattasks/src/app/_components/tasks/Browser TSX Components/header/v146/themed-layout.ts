import { getTaskLayout, getCatalogLayout } from './pure/industrial/src/geometry.mjs';
import { getClassicLayout } from './pure/classic/src/modular-header.mjs';
import {getChaosThemeOption} from './pure/industrial/src/theme-options.mjs';

/**
 * Narrow, typed-at-the-boundary replacement for the kit's mixed header-kit
 * wrapper.  It deliberately contains no DOM/runtime/picker behaviour.
 */
export type V146Theme = 'nurgle' | 'slaanesh' | 'khorne' | 'tzeentch';
export type V146Style = 'industrial' | 'gothic' | 'armor';
export type V146Mode = 'task' | 'catalog';
export type V146Options = {theme?: V146Theme; style?: V146Style; mode?: V146Mode; title?: string; taskTitle?: string; taskNumber?: number};
export type IndustrialTaskTextLayout = {
  title: {rect: readonly [number, number, number, number]; fontSize: number; lineHeight: number};
  number?: {rect: readonly [number, number, number, number]};
};
type HeaderLayout = {
  appearance?: V146Theme;
  appearanceLocation?: 'external';
  fullBackLabel?: string;
  hits?: {prev?: unknown; previous?: unknown; theme?: unknown} & Record<string, unknown>;
  labels?: {back?: {fullText?: string}};
  mode?: V146Mode;
  showTheme?: boolean;
  style?: V146Style;
} & Record<string, unknown>;

export function normalizeTheme(theme: V146Theme): string {
  return getChaosThemeOption(theme).headerTheme;
}

/**
 * Text has a different sizing input from the fixed workspace artwork. Keep
 * that input at this typed boundary so a task title cannot enter SVG layout
 * or rendering options.
 */
export function getIndustrialTaskTextLayout(width: number, title: string, taskNumber: number, theme: V146Theme): IndustrialTaskTextLayout {
  const layout = getTaskLayout(width, {theme: normalizeTheme(theme), title, taskNumber});
  const [titleX, titleY, titleWidth, titleHeight] = layout.labels.title.rect;
  const titleRect: IndustrialTaskTextLayout['title']['rect'] = [titleX, titleY, titleWidth, titleHeight];
  const number = layout.labels.number;
  let numberRect: NonNullable<IndustrialTaskTextLayout['number']>['rect'] | undefined;
  if (number) {
    const [numberX, numberY, numberWidth, numberHeight] = number.rect;
    numberRect = [numberX, numberY, numberWidth, numberHeight];
  }
  return {
    title: {rect: titleRect, fontSize: layout.labels.title.fontSize, lineHeight: layout.labels.title.lineHeight},
    ...(numberRect ? {number: {rect: numberRect}} : {})
  };
}

export function getThemedHeaderLayout(width: number, options: V146Options = {}): HeaderLayout {
  const theme = normalizeTheme(options.theme ?? 'khorne');
  const style = options.style ?? 'industrial';
  const mode = options.mode ?? 'task';
  const next = {...options, theme, style, mode, ...(style === 'industrial' && mode === 'catalog' ? {showTheme: false} : {})};
  const layout: HeaderLayout = (style === 'industrial'
    ? mode === 'catalog' ? getCatalogLayout(width, next) : getTaskLayout(width, next)
    : getClassicLayout(width, next));
  if (layout.hits?.prev && !layout.hits.previous) layout.hits.previous = layout.hits.prev;
  if (layout.labels?.back?.fullText) layout.fullBackLabel = layout.labels.back.fullText;
  layout.mode = mode;
  layout.style = style;
  layout.appearance = options.theme;
  layout.showTheme = false;
  layout.appearanceLocation = 'external';
  if (style !== 'industrial' && layout.hits) delete layout.hits.theme;
  return layout;
}
