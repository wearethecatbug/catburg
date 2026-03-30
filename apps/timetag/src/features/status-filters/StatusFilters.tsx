'use client';

import React from 'react';
import type { TaskStatusFilter } from '@/domain/task.types';
import { useSettings, useTasks } from '@/store';

const STATUS_OPTIONS: { id: TaskStatusFilter; label: string; requiresCompleted?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done', requiresCompleted: true },
  { id: 'archived', label: 'Archived', requiresCompleted: true },
];

export function StatusFilters() {
  const { state, setFilter } = useTasks();
  const { settings } = useSettings();
  const visibleOptions = STATUS_OPTIONS.filter((option) => settings.general.showCompletedTasks || !option.requiresCompleted);

  return (
    <div
      className="flex gap-1 border-b px-4 py-2"
      style={{
        background: 'var(--tt-surface-muted)',
        borderColor: 'var(--tt-border)',
        backdropFilter: 'blur(12px) saturate(1.05)',
      }}
    >
      {visibleOptions.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setFilter({ status: opt.id })}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            state.filter.status === opt.id
              ? ''
              : 'border'
          }`}
          style={state.filter.status === opt.id
            ? { background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }
            : {
              background: 'var(--tt-surface)',
              borderColor: 'var(--tt-border)',
              color: 'var(--tt-text-muted)',
            }}
          aria-pressed={state.filter.status === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

