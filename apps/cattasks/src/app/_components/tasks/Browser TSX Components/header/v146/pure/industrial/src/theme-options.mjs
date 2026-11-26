/**
 * Pure palette metadata retained for the header geometry closure.
 * The application owns its actual theme chooser and storage.
 */
export const CHAOS_THEME_OPTIONS = Object.freeze({
  nurgle: {id: 'nurgle', headerTheme: 'green'},
  slaanesh: {id: 'slaanesh', headerTheme: 'violet'},
  khorne: {id: 'khorne', headerTheme: 'ember'},
  tzeentch: {id: 'tzeentch', headerTheme: 'blue'}
});

export function getChaosThemeOption(value) {
  const option = CHAOS_THEME_OPTIONS[value];
  if (!option) throw new Error(`Unsupported v146 header theme: ${String(value)}`);
  return option;
}
