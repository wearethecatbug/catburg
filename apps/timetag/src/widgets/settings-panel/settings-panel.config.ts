import React from 'react';
import type {
  AppearanceTabId,
  GeneralTabId,
  SettingsSectionId,
  TimerTabId,
} from '@/domain/settings.types';
import { ClipboardIcon, HourglassIcon, SunIcon } from '@/shared';

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

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'general',
    label: 'General',
    icon: React.createElement(ClipboardIcon, { size: 'sm', 'aria-hidden': true }),
  },
  {
    id: 'timer',
    label: 'Timer',
    icon: React.createElement(HourglassIcon, { size: 'sm', 'aria-hidden': true }),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: React.createElement(SunIcon, { size: 'sm', 'aria-hidden': true }),
  },
];

export const SECTION_LABELS: Record<SettingsSectionId, string> = Object.fromEntries(
  SETTINGS_SECTIONS.map((section) => [section.id, section.label]),
) as Record<SettingsSectionId, string>;

