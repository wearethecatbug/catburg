'use client';

import React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownDivider,
  ClockIcon,
  SettingsIcon,
  MoreVerticalIcon,
} from '@/components';

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2">
        <ClockIcon size="xl" color="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">TimeTag</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Settings Icon */}
        <button
          type="button"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Settings"
        >
          <SettingsIcon size="md" />
        </button>

        {/* Overflow Menu */}
        <Dropdown
          trigger={
            <span className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <MoreVerticalIcon size="md" aria-label="More options" />
            </span>
          }
          align="right"
        >
          <DropdownItem>Import Tasks</DropdownItem>
          <DropdownItem>Export Tasks</DropdownItem>
          <DropdownDivider />
          <DropdownItem>Keyboard Shortcuts</DropdownItem>
          <DropdownItem>About TimeTag</DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
