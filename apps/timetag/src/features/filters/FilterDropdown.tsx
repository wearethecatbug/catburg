'use client';

import React from 'react';
import { Dropdown, DropdownDivider, Checkbox, FilterIcon } from '@/components';
import { useTasks } from '@/context';
import { UrgencyLevel } from '@/types';

const URGENCY_OPTIONS: { id: UrgencyLevel; label: string; color: string }[] = [
  { id: 'green', label: 'Green (15+ min)', color: 'bg-green-500' },
  { id: 'yellow', label: 'Yellow (5-15 min)', color: 'bg-yellow-500' },
  { id: 'red', label: 'Red (< 5 min)', color: 'bg-red-500' },
  { id: 'overdue', label: 'Overdue', color: 'bg-red-700' },
];

const AR_WINDOWS: { value: 5 | 10 | 30; label: string }[] = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
];

export function FilterDropdown() {
  const { state, setFilter } = useTasks();

  const toggleUrgency = (urgency: UrgencyLevel) => {
    setFilter({
      urgency: {
        ...state.filter.urgency,
        [urgency]: !state.filter.urgency[urgency],
      },
    });
  };

  const toggleApproachingRed = () => {
    setFilter({
      approachingRed: {
        ...state.filter.approachingRed,
        enabled: !state.filter.approachingRed.enabled,
      },
    });
  };

  const setARWindow = (windowMinutes: 5 | 10 | 30) => {
    setFilter({
      approachingRed: {
        ...state.filter.approachingRed,
        windowMinutes,
      },
    });
  };

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          <FilterIcon size="sm" />
          Filter
        </span>
      }
      align="right"
    >
      <div className="px-4 py-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Urgency
        </p>
        {URGENCY_OPTIONS.map((option) => (
          <div key={option.id} className="flex items-center gap-2 py-1">
            <Checkbox
              checked={state.filter.urgency[option.id]}
              onChange={() => toggleUrgency(option.id)}
            />
            <span className={`w-3 h-3 rounded-full ${option.color}`} />
            <span className="text-sm text-gray-700">{option.label}</span>
          </div>
        ))}
      </div>

      <DropdownDivider />

      <div className="px-4 py-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Approaching Red
        </p>
        <div className="flex items-center gap-2 mb-2">
          <Checkbox
            checked={state.filter.approachingRed.enabled}
            onChange={toggleApproachingRed}
            label="Show approaching red"
          />
        </div>

        {state.filter.approachingRed.enabled && (
          <div className="flex gap-1 mt-2">
            {AR_WINDOWS.map((window) => (
              <button
                key={window.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setARWindow(window.value);
                }}
                className={`px-2 py-1 text-xs rounded ${
                  state.filter.approachingRed.windowMinutes === window.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {window.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Dropdown>
  );
}
