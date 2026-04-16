import type {
  AppearanceTabId,
  GeneralTabId,
  SettingsSectionId,
  TimerTabId,
} from '@/domain/settings.types';

export const GENERAL_TABS: Array<{ id: GeneralTabId; label: string }> = [
  { id: 'behavior', label: 'Behavior' },
  { id: 'defaults', label: 'Defaults' },
  { id: 'interface', label: 'Interface' },
];

export const TIMER_TABS: Array<{ id: TimerTabId; label: string }> = [
  { id: 'mode', label: 'Mode' },
  { id: 'presets', label: 'Presets' },
  { id: 'runtime', label: 'Runtime' },
];

export const APPEARANCE_TABS: Array<{ id: AppearanceTabId; label: string }> = [
  { id: 'theme', label: 'Theme' },
  { id: 'layout', label: 'Layout' },
  { id: 'visualTweaks', label: 'Visual Tweaks' },
];

export const SECTION_LABELS: Record<SettingsSectionId, string> = {
  general: 'General',
  timer: 'Timer',
  appearance: 'Appearance',
};

