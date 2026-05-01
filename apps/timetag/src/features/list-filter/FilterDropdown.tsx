'use client';

import React, { useState } from 'react';
import {
  Dropdown,
  DropdownDivider,
  Checkbox,
  FilterIcon,
  QUERY_CONTROL_MENU_MIN_WIDTH,
  QueryControlTrigger,
} from '@/shared';
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

function getFilterChipButtonStyle(isSelected: boolean): React.CSSProperties {
  return isSelected
    ? { background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }
    : {
        background: 'var(--tt-surface-subtle)',
        color: 'var(--tt-text)',
        border: '1px solid var(--tt-border)',
      };
}

function FilterSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--tt-text-muted)' }}>
      {children}
    </p>
  );
}

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
        <QueryControlTrigger icon={<FilterIcon size="sm" />} label="Filter" />
      }
      align="right"
      menuMinWidth={QUERY_CONTROL_MENU_MIN_WIDTH}
      closeOnSelect={false}
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
    >
      <div className="px-4 py-2">
        <FilterSectionHeading>Urgency</FilterSectionHeading>
        {URGENCY_FILTER_OPTIONS.map((option) => (
          <label key={option.id} className="inline-flex items-center gap-2 py-1">
            <Checkbox
              checked={state.filter.urgency[option.id]}
              onChange={() => toggleUrgency(option.id)}
            />
            <span className="text-sm" style={{ color: 'var(--tt-text)' }}>
              {option.label}
            </span>
          </label>
        ))}
      </div>

      <DropdownDivider />

      <div className="px-4 py-2">
        <FilterSectionHeading>Priority</FilterSectionHeading>
        <div className="flex flex-col gap-1">
          {['normal', 'urgent'].map((p) => (
            <label key={p} className="inline-flex items-center gap-2 py-1">
              <Checkbox
                checked={state.filter.priority[p as TaskPriority]}
                onChange={() => togglePriority(p as TaskPriority)}
              />
              <span className="text-sm capitalize" style={{ color: 'var(--tt-text)' }}>
                {p}
              </span>
            </label>
          ))}
        </div>
      </div>

      <DropdownDivider />

      <div className="px-4 py-2">
        <FilterSectionHeading>Mode</FilterSectionHeading>
        <div className="flex flex-col gap-1">
          {MODE_OPTIONS.map((m) => (
            <label key={m.id} className="inline-flex items-center gap-2 py-1">
              <Checkbox
                checked={Boolean(state.filter.mode[m.id])}
                onChange={() => toggleMode(m.id)}
              />
              <span className="text-sm" style={{ color: 'var(--tt-text)' }}>
                {m.label}
              </span>
            </label>
          ))}
          <div className="mt-1 text-xs" style={{ color: 'var(--tt-text-muted)' }}>
            If none selected — all modes are shown
          </div>
        </div>
      </div>

      <DropdownDivider />

      <div className="px-4 py-2">
        <FilterSectionHeading>Approaching Red</FilterSectionHeading>
        <div className="mb-2 flex items-center gap-2">
          <Checkbox
            checked={state.filter.approachingRed.enabled}
            onChange={toggleApproachingRed}
            label="Show approaching red"
          />
        </div>
        {state.filter.approachingRed.enabled && (
          <div className="mt-2 flex gap-1">
            {AR_WINDOWS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setARWindow(w.value);
                }}
                aria-pressed={state.filter.approachingRed.windowMinutes === w.value}
                className="rounded px-2 py-1 text-xs"
                style={getFilterChipButtonStyle(state.filter.approachingRed.windowMinutes === w.value)}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <DropdownDivider />

      <div className="px-4 py-2">
        <FilterSectionHeading>Reminders</FilterSectionHeading>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHasReminders('any');
            }}
            aria-pressed={state.filter.hasReminders === 'any'}
            className="rounded px-2 py-1 text-xs"
            style={getFilterChipButtonStyle(state.filter.hasReminders === 'any')}
          >
            Any
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHasReminders('yes');
            }}
            aria-pressed={state.filter.hasReminders === 'yes'}
            className="rounded px-2 py-1 text-xs"
            style={getFilterChipButtonStyle(state.filter.hasReminders === 'yes')}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHasReminders('no');
            }}
            aria-pressed={state.filter.hasReminders === 'no'}
            className="rounded px-2 py-1 text-xs"
            style={getFilterChipButtonStyle(state.filter.hasReminders === 'no')}
          >
            No
          </button>
        </div>
        <div className="mt-2 text-xs" style={{ color: 'var(--tt-text-muted)' }}>
          Filter by presence of reminders
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t px-4 py-2" style={{ borderColor: 'var(--tt-border)' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clearAll();
          }}
          className="rounded px-3 py-1 text-sm"
          style={{
            background: 'var(--tt-surface-subtle)',
            color: 'var(--tt-text)',
            border: '1px solid var(--tt-border)',
          }}
        >
          Clear
        </button>
        {/* Done button closes the filter dropdown after immediate filter changes */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          className="rounded px-3 py-1 text-sm"
          style={{ background: 'var(--tt-accent)', color: 'var(--tt-accent-contrast)' }}
          aria-label="Done"
        >
          Done
        </button>
      </div>
    </Dropdown>
  );
}