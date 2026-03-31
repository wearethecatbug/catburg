'use client';

import React from 'react';
import type { TaskPriority } from '@/domain/task.types';

interface PrioritySelectProps {
  priority: TaskPriority;
  onChange: (priority: TaskPriority) => void;
}

const PRIORITY_OPTIONS: Array<{ id: TaskPriority; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'urgent', label: 'Urgent' },
];

export function PrioritySelect({ priority, onChange }: PrioritySelectProps) {
  const groupName = React.useId();

  return (
    <fieldset className="flex flex-col">
      <legend className="mb-2 text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
        Priority
      </legend>
      <div
        className="inline-flex w-fit rounded-xl border p-1"
        style={{
          borderColor: 'var(--tt-border)',
          background: 'var(--tt-surface-muted)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
        }}
      >
        {PRIORITY_OPTIONS.map((option) => (
          <label
            key={option.id}
            className="cursor-pointer rounded-lg"
          >
            <input
              type="radio"
              name={groupName}
              value={option.id}
              checked={priority === option.id}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            <span
              className="inline-flex rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--tt-surface-hover)]"
              style={priority === option.id
                ? {
                    background: option.id === 'urgent' ? 'var(--tt-chip-danger-bg)' : 'var(--tt-chip-active-bg)',
                    color: option.id === 'urgent' ? 'var(--tt-chip-danger-text)' : 'var(--tt-chip-active-text)',
                  }
                : {
                    color: 'var(--tt-text-muted)',
                  }}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

