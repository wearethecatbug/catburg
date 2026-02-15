'use client';

import React from 'react';
import { AddTaskInput } from './AddTaskInput';
import { SearchInput } from './SearchInput';
import { SortDropdown } from './SortDropdown';
import { ActionsDropdown } from './ActionsDropdown';
import { FilterDropdown } from '@/features/filters';
import { Chip } from '@/components';
import { useTasks } from '@/context';
import { useFocusRef } from '@/hooks';

interface ComposerProps {
  onDeleteSelected: () => void;
  addInputRef?: React.RefObject<HTMLInputElement | null>;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function Composer({
  onDeleteSelected,
  addInputRef,
  searchInputRef,
}: ComposerProps) {
  const { state, setFilter } = useTasks();
  const { ref: localAddRef } = useFocusRef<HTMLInputElement>();
  const { ref: localSearchRef } = useFocusRef<HTMLInputElement>();

  const disableApproachingRed = () => {
    setFilter({
      approachingRed: {
        ...state.filter.approachingRed,
        enabled: false,
      },
    });
  };

  return (
    <div className="p-4 space-y-3 bg-white border-b border-gray-200">
      {/* Add Task Input */}
      <AddTaskInput ref={addInputRef ?? localAddRef} />

      {/* Search and Tools Row */}
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <SearchInput ref={searchInputRef ?? localSearchRef} />
        </div>

        <div className="flex items-center gap-2">
          <SortDropdown />
          <FilterDropdown />
          <ActionsDropdown onDeleteSelected={onDeleteSelected} />

          {/* AR Chip */}
          {state.filter.approachingRed.enabled && (
            <Chip onRemove={disableApproachingRed}>
              AR {state.filter.approachingRed.windowMinutes}m
            </Chip>
          )}
        </div>
      </div>
    </div>
  );
}

