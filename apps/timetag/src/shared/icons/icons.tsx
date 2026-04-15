'use client';

import React from 'react';
import { IconBase, type IconProps } from '@/shared/icons/IconBase';

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </IconBase>
  );
}

export function MoreVerticalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </IconBase>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </IconBase>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </IconBase>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </IconBase>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </IconBase>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <IconBase {...props} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </IconBase>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <IconBase {...props} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M8 4.5h6.5l4 4V18a2.5 2.5 0 01-2.5 2.5H8A2.5 2.5 0 015.5 18V7A2.5 2.5 0 018 4.5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M14.5 4.8V9h4.2" />
      <path strokeLinecap="round" strokeWidth={1.6} d="M9 11h5.5" />
      <path strokeLinecap="round" strokeWidth={1.6} d="M9 14h4.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M13.4 16.8l3.9-3.9a1.06 1.06 0 011.5 0l.7.7a1.06 1.06 0 010 1.5l-3.9 3.9-2.4.5z"
      />
    </IconBase>
  );
}

export function UrgentWarningIcon(props: IconProps) {
  return (
    <IconBase {...props} viewBox="0 0 24 24" fill="none" stroke="none">
      <path
        d="M12 3.2L21 19.2a1.4 1.4 0 01-1.22 2.1H4.22A1.4 1.4 0 013 19.2l9-16a1.15 1.15 0 012 0z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 8v5.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.1" r="1.2" fill="currentColor" />
    </IconBase>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </IconBase>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646a9 9 0 1011.708 11.708z"
      />
    </IconBase>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l.6 1.4L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6L19 14z" />
    </IconBase>
  );
}

export function MuteIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </IconBase>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </IconBase>
  );
}

// ============================================================================
// Legacy icon implementations (kept from feature/timetag-refactor)
// ============================================================================

export function HourglassIconLegacy(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v2m0 4v2m6-10H6a1 1 0 00-1 1v2a1 1 0 001 1h1v2H6a1 1 0 00-1 1v2a1 1 0 001 1h12a1 1 0 001-1v-2a1 1 0 00-1-1h-1v-2h1a1 1 0 001-1V5a1 1 0 00-1-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8l2-2m0 4l-2 2m0 0l2 2m-2-2l-2-2" />
    </IconBase>
  );
}

export function CalendarIconLegacy(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 11h1m3 0h1m3 0h1m-7 4h1m3 0h1m3 0h1" />
    </IconBase>
  );
}

export function PomodoroIconLegacy(props: IconProps) {
  return (
    <IconBase {...props}>
      {/* Помидор - красная часть */}
      <circle cx="12" cy="14" r="7" stroke="currentColor" strokeWidth={2} fill="none" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 7C9.238 7 7 9.015 7 11.5c0 2.485 2.238 4.5 5 4.5s5-2.015 5-4.5C17 9.015 14.762 7 12 7z"
        fill="currentColor"
        opacity="0.2"
      />
      {/* Листики на помидоре */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11 6c-1 0-1.5-1-2-1.5M12 5c0.5-0.5 1-1.5 2-1.5M13 6c1 0 1.5-1 2-1.5"
        fill="currentColor"
      />
      {/* Белая середина помидора */}
      <circle cx="12" cy="14" r="3" fill="white" stroke="currentColor" strokeWidth={1.5} />
    </IconBase>
  );
}

// ============================================================================
// Redesigned icon implementations (from fix/timetag-build-error)
// ============================================================================

/**
 * HourglassIcon — for Duration mode
 */
export function HourglassIcon(props: IconProps) {
    return (
        <IconBase {...props}>
            <path
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
            {/* top + bottom caps */}
            <path d="M6.5 3h11" strokeWidth="1.8" />
            <path d="M6.5 21h11" strokeWidth="1.8" />

            {/* outer hourglass frame (outline only) */}
            <path
                d="M8.2 3
           c0 5 4 6.2 4 9
           s-4 4-4 9"
                strokeWidth="1.8"
            />
            <path
                d="M15.8 3
           c0 5-4 6.2-4 9
           s4 4 4 9"
                strokeWidth="1.8"
            />

            {/* pinch marker */}
            <path d="M11 12h2" strokeWidth="1.8" />

            {/* optional "sand" hint (still outline) */}
            <path d="M10.2 8.6h3.6" strokeWidth="1.4" opacity="0.65" />
            <path d="M10.2 15.4h3.6" strokeWidth="1.4" opacity="0.65" />
        </IconBase>
    );
}

/**
 * CalendarIcon — for Deadline mode
 */
export function CalendarIcon(props: IconProps) {
    return (
        <IconBase {...props}>
            <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth={2} stroke="currentColor" fill="none" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3v4M8 3v4M3 11h18" />
        </IconBase>
    );
}

/**
 * PomodoroIcon — tomato silhouette with band and small play-triangle + rays
 * - Filled icon (use fill="currentColor")
 */
export function PomodoroIcon(props: IconProps) {
    return (
        <IconBase  {...props}>
            <path
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            />
            {/* stem */}
            <path d="M12 1.8v2.2" strokeWidth="1.8" />

            {/* leaf crown (calyx) */}
            <path
                d="M12 4.1
           L13.1 5.7
           L15.3 5.0
           L14.1 6.9
           L16.2 8.0
           L13.8 8.2
           L14.6 10.2
           L12.9 9.2
           L12 10.7
           L11.1 9.2
           L9.4 10.2
           L10.2 8.2
           L7.8 8.0
           L9.9 6.9
           L8.7 5.0
           L10.9 5.7
           Z"
                strokeWidth="1.8"
            />

            {/* tomato body outline */}
            <path
                d="M12 6.8
           C7.8 6.8 4.6 9.3 4.2 12.9
           C3.7 17.1 6.8 21.6 12 21.6
           C17.2 21.6 20.3 17.1 19.8 12.9
           C19.4 9.3 16.2 6.8 12 6.8
           Z"
                strokeWidth="1.9"
            />
        </IconBase>
    );
}
