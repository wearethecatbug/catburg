'use client';

import React from 'react';
import type { TaskStatus } from '@/domain/task.types';
import { useTasks } from '@/store';

const STATUS_OPTIONS: { id: TaskStatus; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
];

export function StatusFilters() {
  const { state, setFilter } = useTasks();

  return (
    <div className="flex gap-1 px-4 py-2 bg-gray-50 border-b border-gray-200">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setFilter({ status: opt.id })}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            state.filter.status === opt.id
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
          }`}
          aria-pressed={state.filter.status === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

