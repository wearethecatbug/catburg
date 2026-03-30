'use client';

import React from 'react';
import { Dropdown, DropdownItem, DropdownDivider, MenuIcon } from '@/shared';
import { useTasks } from '@/store';

interface BulkDropdownProps {
  onDeleteSelected: () => void;
}

export function BulkDropdown({ onDeleteSelected }: BulkDropdownProps) {
  const {
    hasSelection,
    selectAll,
    clearSelection,
    pauseSelected,
    playSelected,
    resetSelected,
    markDoneSelected,
    archiveSelected,
  } = useTasks();

  return (
    <Dropdown
      trigger={
        <span
          className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${
            hasSelection ? 'font-medium' : ''
          }`}
          style={{
            color: 'var(--tt-text)',
            background: 'var(--tt-surface-subtle)',
            borderColor: 'var(--tt-border)',
          }}
        >
          <MenuIcon size="sm" />
          Bulk
        </span>
      }
      align="right"
    >
      <DropdownItem onClick={selectAll}>Select all</DropdownItem>
      <DropdownItem onClick={clearSelection} disabled={!hasSelection}>
        Clear selection
      </DropdownItem>

      <DropdownDivider />

      <DropdownItem onClick={pauseSelected} disabled={!hasSelection}>
        Pause selected
      </DropdownItem>
      <DropdownItem onClick={playSelected} disabled={!hasSelection}>
        Play selected
      </DropdownItem>
      <DropdownItem onClick={resetSelected} disabled={!hasSelection}>
        Reset selected
      </DropdownItem>

      <DropdownDivider />

      <DropdownItem onClick={markDoneSelected} disabled={!hasSelection}>
        Mark done
      </DropdownItem>
      <DropdownItem onClick={archiveSelected} disabled={!hasSelection}>
        Archive
      </DropdownItem>

      <DropdownDivider />

      <DropdownItem onClick={onDeleteSelected} danger disabled={!hasSelection}>
        Delete selected
      </DropdownItem>
    </Dropdown>
  );
}

