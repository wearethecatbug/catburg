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
          className="w-full rounded-lg border py-2 pl-9 pr-8 text-sm focus:outline-none"
          style={{
            borderColor: 'var(--tt-border)',
            background: 'var(--tt-input-bg)',
            color: 'var(--tt-text)',
            boxShadow: 'inset 0 0 0 1px transparent',
          }}
          aria-label="Search tasks"
        />
        {state.searchQuery && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
            style={{ color: 'var(--tt-text-soft)' }}
            aria-label="Clear search"
          >
            <CloseIcon size="sm" />
          </button>
        )}
      </div>
    );
  },
);

