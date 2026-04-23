'use client';

import React from 'react';
import {
  Dropdown,
  DropdownItem,
  SortIcon,
  ChevronDownIcon,
  QUERY_CONTROL_MENU_MIN_WIDTH,
  QueryControlTrigger,
} from '@/shared';
import { useTasks } from '@/store';
import type { SortField, SortDirection } from '@/domain/task.types';

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'createdAt', label: 'Date Created' },
  { field: 'updatedAt', label: 'Last Updated' },
  { field: 'remainingSec', label: 'Time Remaining' },
  { field: 'title', label: 'Title' },
  { field: 'priority', label: 'Priority' },
];

export function SortDropdown() {
  const { state, setSort } = useTasks();

  const handleSort = (field: SortField) => {
    const direction: SortDirection =
      state.sort.field === field && state.sort.direction === 'asc' ? 'desc' : 'asc';
    setSort({ field, direction });
  };

  return (
    <Dropdown
      trigger={
        <QueryControlTrigger
          icon={<SortIcon size="sm" />}
          label="Sort"
          trailing={
            <ChevronDownIcon
              size="xs"
              className={`hidden transition-transform sm:block ${state.sort.direction === 'asc' ? 'rotate-180' : ''}`}
            />
          }
        />
      }
      align="right"
      menuMinWidth={QUERY_CONTROL_MENU_MIN_WIDTH}
    >
      {SORT_OPTIONS.map((option) => (
        <DropdownItem key={option.field} onClick={() => handleSort(option.field)}>
          <span className="flex items-center justify-between w-full">
            {option.label}
            {state.sort.field === option.field && (
              <ChevronDownIcon size="sm" className={state.sort.direction === 'asc' ? 'rotate-180' : ''} />
            )}
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

