'use client';

import React from 'react';
import {
  SettingsIcon,
  SunIcon,
  MuteIcon,
  BellIcon,
  UserIcon,
} from '@/shared';

interface HeaderProps {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      {/* Left — Settings */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Settings"
        >
          <SettingsIcon size="md" />
        </button>
        <span className="text-sm font-medium text-gray-700">Settings</span>
      </div>

      {/* Right — compact global controls */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          type="button"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Toggle theme"
        >
          <SunIcon size="md" />
        </button>

        {/* Mute toggle */}
        <button
          type="button"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Toggle mute"
        >
          <MuteIcon size="md" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Notifications"
        >
          <BellIcon size="md" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Profile */}
        <button
          type="button"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Profile"
        >
          <UserIcon size="md" />
        </button>
      </div>
    </header>
  );
}


