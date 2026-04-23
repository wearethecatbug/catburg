import React from 'react';
import type { SettingsSectionId } from '@/domain/settings.types';
import { ClipboardIcon, HourglassIcon, SunIcon } from '@/shared';

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

