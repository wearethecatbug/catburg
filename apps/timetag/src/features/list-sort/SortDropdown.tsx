'use client';

import React from 'react';
import { Dropdown, DropdownItem, SortIcon, ChevronDownIcon } from '@/shared';
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

  const currentLabel = SORT_OPTIONS.find((o) => o.field === state.sort.field)?.label;

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          <SortIcon size="sm" />
          {currentLabel}
          <ChevronDownIcon
            size="xs"
            className={`transition-transform ${state.sort.direction === 'asc' ? 'rotate-180' : ''}`}
          />
        </span>
      }
      align="right"
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

