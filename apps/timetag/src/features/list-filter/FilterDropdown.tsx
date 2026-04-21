'use client';

import React, { useState } from 'react';
import { Dropdown, DropdownDivider, Checkbox, FilterIcon } from '@/shared';
import {
  URGENCY_FILTER_OPTIONS,
  createResettableTaskFilterPatch,
  setApproachingRedEnabled,
  setApproachingRedWindow,
  setHasRemindersFilter,
  toggleModeFilter,
  togglePriorityFilter,
  toggleUrgencyFilter,
} from '@/domain';
import { useTasks } from '@/store';
import type { UrgencyLevel, TimerMode, TaskPriority } from '@/domain/task.types';

const MODE_OPTIONS: { id: TimerMode; label: string }[] = [
  { id: 'duration', label: 'Duration' },
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'note', label: 'Note' },
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
    setFilter(toggleUrgencyFilter(state.filter, urgency));
  };

  const togglePriority = (priority: TaskPriority) => {
    setFilter(togglePriorityFilter(state.filter, priority));
  };

  const toggleMode = (mode: TimerMode) => {
    setFilter(toggleModeFilter(state.filter, mode));
  };

  const setHasReminders = (value: 'any' | 'yes' | 'no') => {
    setFilter(setHasRemindersFilter(value));
  };

  const toggleApproachingRed = () => {
    setFilter(setApproachingRedEnabled(state.filter));
  };

  const setARWindow = (windowMinutes: number) => {
    setFilter(setApproachingRedWindow(state.filter, windowMinutes));
  };

  const clearAll = () => {
    setFilter(createResettableTaskFilterPatch());
  };

  return (
      <Dropdown
          trigger={
            <span
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"
              style={{
                color: 'var(--tt-text)',
                background: 'var(--tt-surface-subtle)',
                borderColor: 'var(--tt-border)',
              }}
            >
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
          <p className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--tt-text-muted)' }}>Urgency</p>
          {URGENCY_FILTER_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-center gap-2 py-1">
                <Checkbox
                    checked={state.filter.urgency[option.id]}
                    onChange={() => toggleUrgency(option.id)}
                />
                <span className="text-sm" style={{ color: 'var(--tt-text)' }}>{option.label}</span>
              </div>
          ))}
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--tt-text-muted)' }}>Priority</p>
          <div className="flex flex-col gap-1">
            {['normal', 'urgent'].map((p) => (
                <label key={p} className="inline-flex items-center gap-2 py-1">
                  <Checkbox
                      checked={state.filter.priority[p as TaskPriority]}
                      onChange={() => togglePriority(p as TaskPriority)}
                  />
                  <span className="text-sm capitalize" style={{ color: 'var(--tt-text)' }}>{p}</span>
                </label>
            ))}
          </div>
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--tt-text-muted)' }}>Mode</p>
          <div className="flex flex-col gap-1">
            {MODE_OPTIONS.map((m) => (
                <label key={m.id} className="inline-flex items-center gap-2 py-1">
                  <Checkbox
                      checked={Boolean(state.filter.mode[m.id])}
                      onChange={() => toggleMode(m.id)}
                  />
                  <span className="text-sm" style={{ color: 'var(--tt-text)' }}>{m.label}</span>
                </label>
            ))}
            <div className="mt-1 text-xs" style={{ color: 'var(--tt-text-muted)' }}>If none selected — all modes are shown</div>
          </div>
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--tt-text-muted)' }}>Approaching Red</p>
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
                        className="rounded px-2 py-1 text-xs"
                        style={state.filter.approachingRed.windowMinutes === w.value
                          ? { background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }
                          : {
                            background: 'var(--tt-surface-subtle)',
                            color: 'var(--tt-text)',
                            border: '1px solid var(--tt-border)',
                          }}
                    >
                      {w.label}
                    </button>
                ))}
              </div>
          )}
        </div>

        <DropdownDivider />

        <div className="px-4 py-2">
          <p className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--tt-text-muted)' }}>Reminders</p>
          <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setHasReminders('any'); }}
                className="rounded px-2 py-1 text-xs"
                style={state.filter.hasReminders === 'any'
                  ? { background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }
                  : {
                    background: 'var(--tt-surface-subtle)',
                    color: 'var(--tt-text)',
                    border: '1px solid var(--tt-border)',
                  }}
            >
              Any
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setHasReminders('yes'); }}
                className="rounded px-2 py-1 text-xs"
                style={state.filter.hasReminders === 'yes'
                  ? { background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }
                  : {
                    background: 'var(--tt-surface-subtle)',
                    color: 'var(--tt-text)',
                    border: '1px solid var(--tt-border)',
                  }}
            >
              Yes
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setHasReminders('no'); }}
                className="rounded px-2 py-1 text-xs"
                style={state.filter.hasReminders === 'no'
                  ? { background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }
                  : {
                    background: 'var(--tt-surface-subtle)',
                    color: 'var(--tt-text)',
                    border: '1px solid var(--tt-border)',
                  }}
            >
              No
            </button>
          </div>
          <div className="mt-2 text-xs" style={{ color: 'var(--tt-text-muted)' }}>Filter by presence of reminders</div>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-2" style={{ borderColor: 'var(--tt-border)' }}>
          <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="rounded px-3 py-1 text-sm"
              style={{
                background: 'var(--tt-surface-subtle)',
                color: 'var(--tt-text)',
                border: '1px solid var(--tt-border)',
              }}
          >
            Clear
          </button>
          {/* Apply button closes the filter dropdown */}
          <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="rounded px-3 py-1 text-sm"
              style={{ background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }}
          >
            Apply
          </button>
        </div>
      </Dropdown>
  );
}