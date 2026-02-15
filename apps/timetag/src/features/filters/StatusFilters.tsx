'use client';

import React from 'react';
import { TaskStatus } from '@/types';
import { useTasks } from '@/context';

const STATUS_FILTERS: { id: TaskStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
];

export function StatusFilters() {
  const { state, setFilter } = useTasks();

  return (
    <div className="flex gap-1 px-4 py-2 bg-gray-50 border-b border-gray-200">
      {STATUS_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => setFilter({ status: filter.id })}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            state.filter.status === filter.id
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
          }`}
          aria-pressed={state.filter.status === filter.id}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

