'use client';

import React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownDivider,
  MenuIcon,
  QUERY_CONTROL_MENU_MIN_WIDTH,
  QueryControlTrigger,
} from '@/shared';
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
        <QueryControlTrigger
          icon={<MenuIcon size="sm" />}
          label="Bulk"
          className={hasSelection ? 'font-medium' : ''}
        />
      }
      align="right"
      menuMinWidth={QUERY_CONTROL_MENU_MIN_WIDTH}
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

