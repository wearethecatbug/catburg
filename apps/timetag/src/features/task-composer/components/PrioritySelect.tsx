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
  const legendId = React.useId();

  return (
    <fieldset className="flex flex-col">
      <legend id={legendId} className="text-xs font-medium text-gray-700 mb-1">
        Priority
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={legendId}
        className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-white w-fit"
      >
        {PRIORITY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            role="radio"
            aria-checked={priority === option.id}
            tabIndex={0}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              priority === option.id
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

