import { getThemedHeaderLayout } from '../../themed-layout';
import { getCompactTaskLayout } from '../size-study/compact-task.mjs';
import { CLASSIC_ASSETS } from '../classic/src/assets.mjs';
import { getClassicCatalogLayoutFromShell } from '../classic/src/modular-header.mjs';
import { GOTHIC_NAVIGATION_GLYPHS } from '../classic/src/gothic-navigation-glyphs.mjs';

/** The bottom of the main horizontal casting, excluding seals and pendants.
 * These are the same source proportions used by the existing band renderers.
 * Keeping this separate from SVG height avoids aligning transparent padding.
 */
export function getWorkspaceHeaderBottom(layout) {
  if (layout.style === 'industrial') {
    const beam = layout.rects.beam;
    return beam[1] + beam[3];
  }

  const d = layout.decor, frame = d.frame;
  const bottom = frame[1] + frame[3];
  if (layout.style === 'gothic') {
    if (layout.mode === 'catalog') return bottom + 8;
    const outer = 8 + d.towerW * .65;
    const centerGap = (d.ornamentW ?? 108) * .4;
    const railHeight = d.lowerRailHeight ?? (layout.width / 2 - centerGap - outer) * 51 / 706;
    return bottom - 3 + railHeight;
  }

  const shoulderHeight = d.shoulderH ?? 126 + 56 * d.q;
  const shoulderWidth = shoulderHeight * 271 / 361;
  const shoulderX = d.shoulderX ?? Math.max(7, frame[0] - shoulderWidth + 3);
  const outer = shoulderX + shoulderWidth * .25;
  const railHeight = d.lowerRailHeight ?? (layout.width / 2 - 35 - outer) * 61 / 700;
  return bottom - 3 + railHeight;
}

/** Reserve one shared slot for both screens and translate the complete live
 * header into it. Artwork, labels and hit areas retain their native geometry.
 */
function getNativeWorkspaceHeaderLayouts(width, options = {}) {
  const taskOptions = { ...options, mode: 'task' };
  const task = options.style === 'industrial'
    ? getThemedHeaderLayout(width, taskOptions)
    : getCompactTaskLayout(width, taskOptions);
  const catalogOptions = { ...options, mode: 'catalog' };
  const originalCatalog = getThemedHeaderLayout(width, catalogOptions);
  const taskBottom = getWorkspaceHeaderBottom(task);
  const catalogBottom = getWorkspaceHeaderBottom(originalCatalog);
  const baseline = Math.max(taskBottom, catalogBottom);
  const originalOffsets = { task: baseline - taskBottom, catalog: baseline - catalogBottom };
  // Preserve the existing content start while the Armor catalogue adopts the
  // Task casting. Smaller art sits in this slot; the slot never follows it up.
  const height = Math.max(task.height + originalOffsets.task, originalCatalog.height + originalOffsets.catalog);
  const catalog = getWorkspaceArmorCatalog(task, originalCatalog, catalogOptions);
  const offsets = { task: baseline - taskBottom, catalog: baseline - getWorkspaceHeaderBottom(catalog) };
  return { task, catalog, baseline, height, offsets };
}

const styles = ['industrial', 'gothic', 'armor'];
const gods = ['nurgle', 'slaanesh', 'khorne', 'tzeentch'];
const envelopeCache = new Map();
const boundedWidth = value => Math.max(288, Math.min(1600, Math.floor(Number(value) || 288)));

/** All appearances occupy the accepted gods' common envelope. Keep the
 * complete native compositions intact: translate artwork, labels and hit
 * areas together, and reserve the largest existing space below the rail.
 * The contract depends only on width, never on the selected page or title.
 */
export function getWorkspaceHeaderEnvelope(availableWidth) {
  const width = boundedWidth(availableWidth);
  if (envelopeCache.has(width)) return envelopeCache.get(width);
  const pairs = styles.flatMap(style => gods.map(theme =>
    getNativeWorkspaceHeaderLayouts(width, {
      style, theme, title: 'Reverse a String', taskTitle: 'Reverse a String', taskNumber: 1
    })
  ));
  const baseline = Math.max(...pairs.map(pair => pair.baseline));
  const height = Math.ceil(baseline + Math.max(...pairs.map(pair => pair.height - pair.baseline)));
  const envelope = Object.freeze({ width, baseline, height });
  if (envelopeCache.size >= 256) envelopeCache.delete(envelopeCache.keys().next().value);
  envelopeCache.set(width, envelope);
  return envelope;
}

function getPlacedNativeHeaderLayouts(availableWidth, options = {}) {
  const envelope = getWorkspaceHeaderEnvelope(availableWidth);
  const native = getNativeWorkspaceHeaderLayouts(envelope.width, options);
  const lift = envelope.baseline - native.baseline;
  return {
    ...native,
    height: envelope.height,
    baseline: envelope.baseline,
    offsets: { task: native.offsets.task + lift, catalog: native.offsets.catalog + lift }
  };
}

export function getWorkspaceHeaderLayouts(availableWidth, options = {}) {
  const pair = pairCompactGothicNavigation(getPlacedNativeHeaderLayouts(availableWidth, options), options);
  return sizeGothicWorkspaceNavigation(sizeGothicWorkspaceReturn(pair, options));
}

/** Capybara adopts the established Gothic Task control locations. Both of
 * its pages keep those same slots, including the reserved task-number band.
 * Decorations can differ without moving any of the interactive anchors.
 */
export function getWorkspaceCapybaraAnchors(availableWidth) {
  const pair = getPlacedNativeHeaderLayouts(availableWidth, {
    style: 'gothic', theme: 'nurgle', title: 'Reverse a String', taskNumber: 1
  });
  const layout = pair.task, offset = pair.offsets.task;
  const moved = rect => rect?.map((value, index) => index === 1 ? value + offset : value);
  return {
    width: layout.width, height: pair.height, baseline: pair.baseline,
    back: moved(layout.hits.back), title: moved(layout.labels.title.rect),
    number: moved(layout.labels.number.rect), previous: moved(layout.hits.previous), next: moved(layout.hits.next),
    appearance: [layout.width - 58, 8, 44, 44],
    titleFontSize: layout.labels.title.fontSize, backFontSize: layout.labels.back.fontSize,
    compact: layout.width <= 622
  };
}


// Co-located from workspace/armor-header-pair.mjs; sole consumer above.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const armorMix = (from, to, progress) => from + (to - from) * progress;
const armorSmooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const armorMixRect = (from, to, progress) => from.map((value, index) => armorMix(value, to[index], progress));

function shellMetrics(layout) {
  const d = layout.decor, f = d.frame;
  const shoulderH = d.shoulderH ?? 126 + 56 * d.q;
  const shoulderW = shoulderH * 271 / 361;
  const shoulderX = d.shoulderX ?? Math.max(7, f[0] - shoulderW + 3);
  const outer = shoulderX + shoulderW * .25;
  return {
    shoulderH, shoulderW, shoulderX,
    lowerRailHeight: d.lowerRailHeight ?? (layout.width / 2 - 35 - outer) * 61 / 700,
    claspW: d.claspW ?? armorMix(52, 84 + 46 * d.q, armorSmooth((layout.width - 430) / 192))
  };
}

/** Keep the two Armor screens inside one casting. Task supplies the native
 * shoulder, crest, vent and rail sizes; Catalog only changes the inner plate
 * and relief. The caller retains the established shared vertical envelope.
 */
export function getWorkspaceArmorCatalog(task, catalog, options = {}) {
  if (task.style !== 'armor' || task.width <= 622) return catalog;

  const progress = armorSmooth((task.width - 622) / 212);
  const liftProgress = armorSmooth((task.width - 622) / 136);
  const contentProgress = armorSmooth((task.width - 718) / 116);
  const source = shellMetrics(catalog), target = shellMetrics(task);
  const from = catalog.decor, to = task.decor, tf = to.frame;
  // At the tablet edge the frame still sits partly beneath its shoulder.
  // Open the broad field only when the centered Task plate moves inward.
  const inset = Math.min(tf[0], target.shoulderX + target.shoulderW - 3);
  const targetFrame = [inset, tf[1], task.width - inset * 2, tf[3]];
  const frame = armorMixRect(from.frame, targetFrame, progress);
  const crest = armorMixRect(from.crest, to.crest, progress);
  const back = armorMixRect(from.back, to.back, progress);
  // Lift the control clear of the body before the independent inscription
  // moves into its centre. A single simultaneous blend crossed those faces.
  back[1] = armorMix(from.back[1], to.back[1], liftProgress);
  const decor = {
    ...from, frame, crest, back,
    shoulderH: armorMix(source.shoulderH, target.shoulderH, progress),
    shoulderX: armorMix(source.shoulderX, target.shoulderX, progress),
    lowerRailHeight: armorMix(source.lowerRailHeight, target.lowerRailHeight, progress),
    ventBandH: armorMix(from.ventBandH, to.ventBandH, progress),
    claspW: armorMix(source.claspW, target.claspW, progress),
    outerY: armorMix(from.outerY, to.outerY, progress),
    outerBottom: armorMix(from.outerBottom, to.outerBottom, progress),
    sharedArmorShell: true,
    sharedArmorProgress: contentProgress
  };
  // Armor's native button fills its destination; unlike Gothic it has no
  // projecting barbs. Share its cap and safe underpaint geometry with Task.
  const sourceButton = CLASSIC_ASSETS.armor[task.theme].parts['back-button'];
  const bodyRows = { blue: [5, 178], green: [7, 176], ember: [5, 181], violet: [5, 180] };
  const [bodyTop, bodyBottom] = bodyRows[task.theme], scale = back[3] / sourceButton[3];
  decor.backArtwork = back.slice();
  decor.backPaintedBody = [back[0], back[1] + bodyTop * scale, back[2], (bodyBottom - bodyTop) * scale];
  decor.backCapWidth = Math.min(26, back[2] / 3);

  const shell = {
    ...catalog,
    height: armorMix(catalog.height, task.height, progress),
    decor,
    anchor: { ...catalog.anchor, frame: frame.slice(), crest: crest.slice(), back: back.slice(), baseline: frame[1] + frame[3] }
  };
  return getClassicCatalogLayoutFromShell(shell, {
    ...options,
    sharedCatalogBack: {
      rect: back,
      fontSize: armorMix(catalog.labels.back.fontSize, 22, progress),
      iconSize: armorMix(catalog.rects.backArrow?.[2] ?? 16, 20, progress),
      gap: armorMix(8, 10, progress)
    }
  });
}


// Co-located from workspace/gothic-compact-navigation.mjs; sole consumer above.
const navRound = rect => rect.map(value => Math.round(value * 1000) / 1000);
const move = (rect, offset) => [rect[0], rect[1] + offset, rect[2], rect[3]];

/** A readable return plate occupies the same upper-left shoulder on both
 * compact pages. The native crown, towers, title frame and bottom rail retain
 * their placement; only this navigation bay and the catalogue inscription move.
 * Apply after the shared envelope, so the accepted Capybara anchors stay native.
 */
export function pairCompactGothicNavigation(pair, options = {}) {
  const { task, catalog, offsets } = pair, width = task.width;
  if (task.style !== 'gothic' || width >= 1040) return pair;
  const progress = armorSmooth((width - 622) / 212), amount = 1 - progress;
  const left = 8 + task.decor.towerW + 6;
  // Keep the whole central shrine clear. At the smallest width the short
  // label fits without an arrow; its 44px painted and clickable height remains.
  const right = width / 2 - task.decor.crest[2] * .19 - 8;
  const top = Math.max(offsets.task, offsets.catalog, task.decor.frame[1] + offsets.task - 50);
  const compact = [left, top, Math.min(144, right - left), 44];
  const measure = (text, size, role) => {
    const measured = options.measureText?.(text, size, role);
    return Number.isFinite(measured) ? measured : String(text).length * size * .54;
  };
  const adapt = (layout, mode) => {
    const offset = offsets[mode], original = move(layout.rects.back, offset);
    const back = move(armorMixRect(compact, original, progress), -offset);
    // The inherited tablet return also crosses its tower for a short range.
    // Keep the complete plate inside the same safe edge as it grows outward.
    if (mode === 'task') back[0] = Math.max(back[0], left);
    // Switch the plate with the existing compact renderer breakpoint. Fading
    // two different bevels makes their faces translucent over the cornice.
    const decor = { ...layout.decor, back: back.slice(), compactReturn: width <= 622 };
    const oldBack = layout.rects.back, scaleY = back[3] / oldBack[3];
    for (const name of ['backArtwork', 'backPaintedBody']) if (layout.decor[name]) {
      const paint = layout.decor[name];
      decor[name] = [back[0], back[1] + (paint[1] - oldBack[1]) * scaleY, back[2], paint[3] * scaleY];
    }
    if (Number.isFinite(decor.backCapWidth)) decor.backCapWidth = Math.min(back[2] / 3, decor.backCapWidth * scaleY);
    if (!amount) {
      const dx = back[0] - oldBack[0];
      if (!dx) return layout;
      const shift = rect => [rect[0] + dx, ...rect.slice(1)];
      const rects = { ...layout.rects, back: navRound(back) };
      if (layout.rects.backArrow) rects.backArrow = shift(layout.rects.backArrow);
      const labels = { ...layout.labels, back: { ...layout.labels.back, rect: shift(layout.labels.back.rect) } };
      return { ...layout, rects, hits: { ...layout.hits, back: shift(layout.hits.back) }, labels, text: labels, decor,
        anchor: { ...layout.anchor, back: back.slice() } };
    }
    const fontSize = armorMix(15, layout.labels.back.fontSize, progress), icon = 16, gap = 6, pad = 8;
    const full = layout.labels.back.fullText;
    const text = width > 622 && measure(full, fontSize, 'back') + icon + gap + pad * 2 <= back[2] ? full : 'Back';
    const textWidth = measure(text, fontSize, 'back');
    const showArrow = textWidth + icon + gap + pad * 2 <= back[2];
    const groupWidth = textWidth + (showArrow ? icon + gap : 0), x = back[0] + (back[2] - groupWidth) / 2;
    const cy = back[1] + back[3] / 2, rects = { ...layout.rects, back: navRound(back) };
    delete rects.backArrow;
    if (showArrow) rects.backArrow = navRound([x, cy - icon / 2, icon, icon]);
    const labels = { ...layout.labels, back: { ...layout.labels.back, text, fontSize, rect: navRound([x + (showArrow ? icon + gap : 0), cy - 18, textWidth, 36]) } };
    if (mode === 'catalog') {
      const opening = layout.decor.catalogOpening, inset = 8 + layout.decor.towerW + 12;
      // Back now belongs to the shoulder; the inscription can use the quiet
      // opening below it, with an optical centre shared by the task title.
      const title = [inset, opening[1] + 4, width - inset * 2, opening[3] - 8];
      labels.title = { ...layout.labels.title, rect: navRound(armorMixRect(title, layout.labels.title.rect, progress)) };
      const heading = labels.title, headingWidth = measure(heading.text, heading.fontSize, 'title') + String(heading.text).length * (heading.letterSpacing || 0);
      if (headingWidth <= heading.rect[2]) Object.assign(heading, { lines: [heading.text], truncated: false });
    }
    return { ...layout, rects, hits: { ...layout.hits, back: navRound(back) }, labels, text: labels,
      visibleBackLabel: text, decor,
      anchor: { ...layout.anchor, back: back.slice() } };
  };
  return { ...pair, task: adapt(task, 'task'), catalog: adapt(catalog, 'catalog') };
}


// Co-located from workspace/gothic-navigation-sizing.mjs; sole consumer above.


/** Widen the live side controls without resizing the title's cast frame.
 * The whole quiet side bay is clickable; the rune keeps clear of the tower,
 * including on phones where only its ink needs a small inward adjustment.
 */
export function sizeGothicWorkspaceNavigation(pair) {
  const layout = pair.task;
  if (layout.style !== 'gothic') return pair;
  const progress = armorSmooth((layout.width - 430) / 404), title = layout.labels.title.rect;
  const hits = { ...layout.hits }, rects = { ...layout.rects };
  for (const key of ['previous', 'next']) {
    const old = layout.hits[key], cx = old[0] + old[2] / 2, cy = old[1] + old[3] / 2;
    const titleEdge = key === 'previous' ? title[0] : title[0] + title[2];
    const room = Math.abs(titleEdge - cx) - 2;
    const width = Math.min(52 + 12 * progress, room * 2), height = 56 + 8 * progress;
    hits[key] = navRound([cx - width / 2, cy - height / 2, width, height]);
    const glyphH = 32 + 8 * progress, glyphW = glyphH * 34 / 40;
    const inkHalf = 14.4 * glyphH / 40;
    const towerEdge = 8 + layout.decor.towerW;
    const minCenter = key === 'previous' ? towerEdge + 2 + inkHalf : titleEdge + 3 + inkHalf;
    const maxCenter = key === 'previous' ? titleEdge - 3 - inkHalf : layout.width - towerEdge - 2 - inkHalf;
    const glyphCenter = Math.max(minCenter, Math.min(maxCenter, cx));
    rects[key === 'previous' ? 'arrowPrevious' : 'arrowNext'] = navRound([glyphCenter - glyphW / 2, cy - glyphH / 2, glyphW, glyphH]);
  }
  return { ...pair, task: { ...layout, hits, rects, controlGlyphs: GOTHIC_NAVIGATION_GLYPHS } };
}


// Co-located from workspace/gothic-return-sizing.mjs; sole consumer above.

const BODY_ROWS = { blue: [28, 165], green: [29, 166], ember: [27, 164], violet: [27, 160] };

/** Size the visible enamel and bevel, rather than the atlas's transparent
 * margins and decorative barbs. The floating return remains substantial from
 * compact to tablet and then joins the already larger desktop dock naturally.
 * This workspace-only paint adjustment leaves every interactive box in place.
 */
export function sizeGothicWorkspaceReturn(pair, options = {}) {
  const layout = pair.task, d = layout.decor;
  if (layout.style !== 'gothic' || layout.width <= 622 || d.embeddedBackMix >= 1) return pair;
  const back = layout.rects.back, cy = back[1] + back[3] / 2;
  const progress = armorSmooth((layout.width - 622) / 212), dock = d.embeddedBackMix || 0;
  const [bodyTop, bodyBottom] = BODY_ROWS[layout.theme];
  const source = CLASSIC_ASSETS.gothic[layout.theme].parts['back-button'];
  const faceHeight = Math.min(back[3], Math.max(d.backPaintedBody[3], back[3] - 8, 44 + 4 * progress));
  const scale = faceHeight / (bodyBottom - bodyTop), faceY = cy - faceHeight / 2;
  const decor = { ...d,
    backArtwork: [back[0], faceY - bodyTop * scale, back[2], source[3] * scale],
    backPaintedBody: [back[0], faceY, back[2], faceHeight],
    backCapWidth: Math.min(back[2] / 3, 78 * scale)
  };
  const old = layout.labels.back, measure = (text, size) => {
    const measured = options.measureText?.(text, size, 'back');
    return Number.isFinite(measured) ? measured : String(text).length * size * .54;
  };
  let fontSize = armorMix(Math.max(old.fontSize, 15 + 4 * progress), old.fontSize, dock);
  const icon = armorMix(16 + 2 * progress, layout.rects.backArrow[2], dock), gap = 6 + 2 * progress;
  while (fontSize > old.fontSize && measure(old.text, fontSize) + icon + gap + 24 > back[2]) fontSize = Math.max(old.fontSize, fontSize - .25);
  const textWidth = measure(old.text, fontSize), x = back[0] + (back[2] - textWidth - icon - gap) / 2;
  const labels = { ...layout.labels, back: { ...old, fontSize, rect: navRound([x + icon + gap, cy - 18, textWidth, 36]) } };
  const rects = { ...layout.rects, backArrow: navRound([x, cy - icon / 2, icon, icon]) };
  return { ...pair, task: { ...layout, decor, labels, text: labels, rects } };
}
