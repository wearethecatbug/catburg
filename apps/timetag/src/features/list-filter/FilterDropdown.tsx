'use client';

import React, { useState } from 'react';
import { Dropdown, DropdownDivider, Checkbox, FilterIcon } from '@/shared';
import { URGENCY_FILTER_OPTIONS } from '@/domain';
import { useTasks } from '@/store';
import type { UrgencyLevel, TimerMode, TaskPriority } from '@/domain/task.types';

const MODE_OPTIONS: { id: TimerMode; label: string }[] = [
  { id: 'duration', label: 'Duration' },
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'deadline', label: 'Deadline' },
];

const AR_WINDOWS: { value: number; label: string }[] = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
];

export function FilterDropdown() {
  const { state, setFilter } = useTasks();
  const [isOpen, setIsOpen] = useState(false);

  const toggleUrgency = (urgency: UrgencyLevel) => {
    setFilter({
      urgency: { ...state.filter.urgency, [urgency]: !state.filter.urgency[urgency] },
    });
  };

  const togglePriority = (priority: TaskPriority) => {
    setFilter({
      priority: { ...state.filter.priority, [priority]: !state.filter.priority[priority] },
    });
  };

  const toggleMode = (mode: TimerMode) => {
    setFilter({
      mode: { ...state.filter.mode, [mode]: !state.filter.mode[mode] },
    });
  };

  const setHasReminders = (value: 'any' | 'yes' | 'no') => {
    setFilter({ hasReminders: value });
  };

  const toggleApproachingRed = () => {
    setFilter({
      approachingRed: { ...state.filter.approachingRed, enabled: !state.filter.approachingRed.enabled },
    });
  };

  const setARWindow = (windowMinutes: number) => {
    setFilter({
      approachingRed: { ...state.filter.approachingRed, windowMinutes },
    });
  };

  const clearAll = () => {
    setFilter({
      urgency: { normal: true, warn: true, danger: true, overdue: true },
      priority: { normal: true, urgent: true },
      mode: { duration: true, pomodoro: true, deadline: true },
      approachingRed: { enabled: false, windowMinutes: 10 },
      hasReminders: 'any',
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
          closeOnSelect={false}
          isOpen={isOpen}
          onOpen={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
      >
        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Urgency</p>
          {URGENCY_FILTER_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-center gap-2 py-1">
                <Checkbox
                    checked={state.filter.urgency[option.id]}
                    onChange={() => toggleUrgency(option.id)}
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </div>
          ))}
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Priority</p>
          <div className="flex flex-col gap-1">
            {['normal', 'urgent'].map((p) => (
                <label key={p} className="inline-flex items-center gap-2 py-1">
                  <Checkbox
                      checked={state.filter.priority[p as TaskPriority]}
                      onChange={() => togglePriority(p as TaskPriority)}
                  />
                  <span className="text-sm text-gray-700 capitalize">{p}</span>
                </label>
            ))}
          </div>
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Mode</p>
          <div className="flex flex-col gap-1">
            {MODE_OPTIONS.map((m) => (
                <label key={m.id} className="inline-flex items-center gap-2 py-1">
                  <Checkbox
                      checked={Boolean(state.filter.mode[m.id])}
                      onChange={() => toggleMode(m.id)}
                  />
                  <span className="text-sm text-gray-700">{m.label}</span>
                </label>
            ))}
            <div className="text-xs text-gray-500 mt-1">If none selected — all modes are shown</div>
          </div>
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Approaching Red</p>
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
                checked={state.filter.approachingRed.enabled}
                onChange={toggleApproachingRed}
                label="Show approaching red"
            />
          </div>
          {state.filter.approachingRed.enabled && (
              <div className="flex gap-1 mt-2">
                {AR_WINDOWS.map((w) => (
                    <button
                        key={w.value}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setARWindow(w.value); }}
                        className={`px-2 py-1 text-xs rounded ${
                            state.filter.approachingRed.windowMinutes === w.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {w.label}
                    </button>
                ))}
              </div>
          )}
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Reminders</p>
          <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setHasReminders('any'); }}
                className={`px-2 py-1 text-xs rounded ${state.filter.hasReminders === 'any' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Any
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setHasReminders('yes'); }}
                className={`px-2 py-1 text-xs rounded ${state.filter.hasReminders === 'yes' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Yes
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setHasReminders('no'); }}
                className={`px-2 py-1 text-xs rounded ${state.filter.hasReminders === 'no' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              No
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">Filter by presence of reminders</div>
        </div>

        <div className="px-4 py-2 flex justify-end gap-2 border-t border-gray-100">
          <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="px-3 py-1 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Clear
          </button>
          {/* Apply button closes the filter dropdown */}
          <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </Dropdown>
  );
}