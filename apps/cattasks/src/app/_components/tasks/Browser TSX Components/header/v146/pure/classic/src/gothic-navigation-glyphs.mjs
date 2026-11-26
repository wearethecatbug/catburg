/** A directional rune: one open arrowhead, a shaft and a small diamond heel.
 * Both the live controls and exported header use these exact vector strokes.
 */
export const GOTHIC_NAVIGATION_GLYPHS = Object.freeze({
  previous: Object.freeze({ id: 'gothic-rune', viewBox: '0 0 34 40', path: 'M17 5L4 20L17 35M4 20H20M25 14L30 20L25 26L20 20Z', strokeWidth: 2.8, linecap: 'square', linejoin: 'bevel' }),
  next: Object.freeze({ id: 'gothic-rune', viewBox: '0 0 34 40', path: 'M17 5L30 20L17 35M30 20H14M9 14L4 20L9 26L14 20Z', strokeWidth: 2.8, linecap: 'square', linejoin: 'bevel' })
});

export function renderGothicNavigationGlyph(layout, key, ink) {
  const glyph = layout.controlGlyphs?.[key];
  if (!glyph) return '';
  const b = layout.rects[key === 'previous' ? 'arrowPrevious' : 'arrowNext'];
  return `<svg x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" viewBox="${glyph.viewBox}" aria-hidden="true" data-gothic-navigation="${key}"><path d="${glyph.path}" fill="none" stroke="${ink}" stroke-width="${glyph.strokeWidth}" stroke-linecap="${glyph.linecap}" stroke-linejoin="${glyph.linejoin}"/></svg>`;
}
