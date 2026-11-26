import { REGISTERED_ART } from './registered-art.mjs';

const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** The compact shoulder uses the complete native bevel from the catalogue.
 * Its face fills the control height; the ornamental transparent margins of the
 * desktop Task button cannot silently shrink it. Caps keep their native scale.
 */
export function renderGothicCompactReturn(layout, options = {}) {
  if (layout.style !== 'gothic' || !layout.decor.compactReturn) return { defs: '', body: '' };
  const art = REGISTERED_ART.gothic.catalog[layout.theme], b = layout.decor.back;
  const prefix = String(options.idPrefix || 'gothic').replace(/[^\w-]/g, '-') + '-compact-return';
  const href = esc(options.resolveAsset ? options.resolveAsset(art.file) : `${String(options.assetBase || './classic/assets').replace(/\/$/, '')}/${art.file}`);
  const reference = [29, 18, 1907, 794], bounds = art.bounds;
  const sx = (bounds[2] - bounds[0]) / (reference[2] - reference[0]);
  const sy = (bounds[3] - bounds[1]) / (reference[3] - reference[1]);
  const crop = (source, target) => {
    const view = [bounds[0] + (source[0] - reference[0]) * sx, bounds[1] + (source[1] - reference[1]) * sy, source[2] * sx, source[3] * sy];
    return `<svg x="${target[0]}" y="${target[1]}" width="${target[2]}" height="${target[3]}" viewBox="${view.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><use href="#${prefix}-paint"/></svg>`;
  };
  const source = [1057, 351, 632, 193], scale = b[3] / source[3], cap = 92 * scale, step = 448 * scale;
  const middle = [b[0] + cap - .35, b[1], b[2] - cap * 2 + .7, b[3]];
  let tiled = '';
  for (let x = middle[0]; x < middle[0] + middle[2]; x += step - .25) tiled += crop([1149, 351, 448, 193], [x, b[1], step, b[3]]);
  const x = b[0] + scale, y = b[1] + scale, right = b[0] + b[2] - scale, bottom = b[1] + b[3], corner = 48 * scale;
  const outline = `M${x + corner} ${y}H${right - corner}L${right} ${y + corner}V${bottom - corner}L${right - corner} ${bottom}H${x + corner}L${x} ${bottom - corner}V${y + corner}Z`;
  const defs = `<image id="${prefix}-paint" href="${href}" width="${art.size[0]}" height="${art.size[1]}"/><clipPath id="${prefix}-middle"><rect x="${middle[0]}" y="${middle[1]}" width="${middle[2]}" height="${middle[3]}"/></clipPath><clipPath id="${prefix}-bevel"><path d="${outline}"/></clipPath>`;
  const plate = `<g clip-path="url(#${prefix}-middle)">${tiled}</g>` + crop([1057, 351, 92, 193], [b[0], b[1], cap, b[3]]) + crop([1597, 351, 92, 193], [b[0] + b[2] - cap, b[1], cap, b[3]]);
  return { defs, body: `<g data-gothic-compact-return="shared-shoulder" clip-path="url(#${prefix}-bevel)">${plate}</g>` };
}
