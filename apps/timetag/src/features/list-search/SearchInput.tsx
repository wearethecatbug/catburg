'use client';

import React, { forwardRef } from 'react';
import { useTasks } from '@/store';
import { SearchIcon, CloseIcon } from '@/shared/icons';

export const SearchInput = forwardRef<HTMLInputElement>(
  function SearchInput(_props, ref) {
    const { state, setSearch } = useTasks();

    return (
      <div className="relative">
        <SearchIcon size="sm" color="text-gray-400" className="absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          ref={ref}
          type="text"
          value={state.searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks... (Ctrl+K)"
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search tasks"
        />
        {state.searchQuery && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <CloseIcon size="sm" />
          </button>
        )}
      </div>
    );
  },
);

