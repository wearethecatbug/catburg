import { renderHeaderArtwork as renderIndustrial } from './pure/industrial/src/render.mjs';
import { renderClassicHeader } from './pure/classic/src/modular-header.mjs';
import { renderCompactTaskArtwork } from './pure/size-study/compact-task.mjs';
import {normalizeTheme, type V146Theme} from './themed-layout';

const PREFIX = '/cattasks-art/v146/';
const CLASSIC_ASSETS = [
    'armor-catalog-insets-v136.png', 'armor-dock-texture-v135.png', 'armor-side-chassis-ember-v122.png', 'armor-side-chassis-green-v122.png', 'armor-side-chassis-violet-v135.png', 'armor-vent-rail-ember.png', 'armor-vent-rail-green.png', 'armor-vent-rail-violet.png', 'atlas-armor-ember.png', 'atlas-armor-green.png', 'atlas-armor-violet.png', 'atlas-gothic-ember.png', 'atlas-gothic-green.png', 'atlas-gothic-violet.png', 'catalog-mobile-armor-ember.png', 'catalog-mobile-armor-green.png', 'catalog-mobile-armor-violet.png', 'catalog-mobile-gothic-ember.png', 'catalog-mobile-gothic-green.png', 'catalog-mobile-gothic-violet.png', 'gothic-apex-skulls-v11.png', 'gothic-arch-daemon-silhouettes-v134.png', 'gothic-catalog-cornice-continuous-atlas.png', 'gothic-catalog-relief-ember-v1.png', 'gothic-catalog-relief-green-v1.png', 'gothic-catalog-relief-v2.png', 'gothic-cornice-castings-v5.png', 'gothic-cornice-continuous-atlas.png', 'gothic-dock-texture-v123.png', 'gothic-khorne-canopy-left-v132.png', 'gothic-khorne-canopy-right-v132.png', 'gothic-khorne-recess-relief-v132.png', 'gothic-nurgle-recess-relief-v131.png', 'gothic-nurgle-tentacle-canopy-left-v131.png', 'gothic-nurgle-tentacle-canopy-right-v131.png', 'gothic-slaanesh-canopy-left-v132.png', 'gothic-slaanesh-canopy-right-v132.png', 'gothic-slaanesh-recess-relief-v132.png', 'gothic-task-arcade-atlas-v133.png', 'material-aged-brass.png', 'material-enamel-ember.png', 'material-enamel-green.png', 'material-enamel-violet.png', 'material-forged-iron.png', 'panel-armor-ember.png', 'panel-armor-green.png', 'panel-armor-violet.png', 'panel-gothic-ember.png', 'panel-gothic-green.png', 'panel-gothic-violet.png', 'tablet-task-gothic-ember.png', 'tablet-task-gothic-green.png', 'tablet-task-gothic-violet.png'
].map(name => `classic/${name}`);
const INDUSTRIAL_ASSETS = [
    'back-button-housing.png', 'back-button-mount.png', 'beam.png', 'control-metal-face.png', 'crest-gem.png', 'crest-metal.png', 'daemon-iron-support-v1.png', 'forged-iron-backing.png', 'glowing-arches.png', 'khorne-left.png', 'nurgle-left.png', 'slaanesh-left.png', 'panel-strip-metal.png', 'right-armor-cap.png', 'theme-badge.png', 'title-frame.png', 'vent-frame.png'
].map(name => `industrial/${name}`);
const ALLOWED = new Set([...CLASSIC_ASSETS, ...INDUSTRIAL_ASSETS]);

export function resolveHeaderAsset(name: string): string {
  const raw = String(name);
  const normalized = /^(classic|industrial)\//.test(raw)
    ? raw
    : `classic/${raw}`;
  if (!ALLOWED.has(normalized)) throw new Error(`Unsupported v146 artwork asset: ${raw}`);
  return `${PREFIX}${normalized}`;
}

export function renderHeaderArtwork(layout: {mode?: 'task' | 'catalog'; style: string; sizeStudy?: boolean}, theme: V146Theme): string {
  const prefix = layout.style === 'industrial' ? 'industrial' : 'classic';
  const resolveAsset = (name: string) => resolveHeaderAsset(/^(classic|industrial)\//.test(name) ? name : `${prefix}/${name}`);
  const options = {includeLabels: false, resolveAsset, idPrefix: 'cattasks-v146', theme: normalizeTheme(theme)};
  if (layout.style === 'industrial') return renderIndustrial(layout, options);
  return layout.mode === 'task' ? renderCompactTaskArtwork(layout, options) : renderClassicHeader(layout, options);
}
