import type {
  FilterState,
  TaskPriority,
  TimerMode,
  UrgencyLevel,
} from './task.types';

export function createDefaultTaskFilter(): FilterState {
  return {
    status: 'active',
    urgency: { normal: true, warn: true, danger: true, overdue: true },
    priority: { normal: true, urgent: true },
    approachingRed: { enabled: false, windowMinutes: 10 },
    mode: { duration: true, pomodoro: true, deadline: true },
    hasReminders: 'any',
  };
}

export function createResettableTaskFilterPatch(): Omit<FilterState, 'status'> {
  const defaults = createDefaultTaskFilter();

  return {
    urgency: defaults.urgency,
    priority: defaults.priority,
    approachingRed: defaults.approachingRed,
    mode: defaults.mode,
    hasReminders: defaults.hasReminders,
  };
}

export function toggleUrgencyFilter(
  filter: FilterState,
  urgency: UrgencyLevel,
): Pick<FilterState, 'urgency'> {
  return {
    urgency: {
      ...filter.urgency,
      [urgency]: !filter.urgency[urgency],
    },
  };
}

export function togglePriorityFilter(
  filter: FilterState,
  priority: TaskPriority,
): Pick<FilterState, 'priority'> {
  return {
    priority: {
      ...filter.priority,
      [priority]: !filter.priority[priority],
    },
  };
}

export function toggleModeFilter(
  filter: FilterState,
  mode: TimerMode,
): Pick<FilterState, 'mode'> {
  return {
    mode: {
      ...filter.mode,
      [mode]: !filter.mode[mode],
    },
  };
}

export function setHasRemindersFilter(
  hasReminders: NonNullable<FilterState['hasReminders']>,
): Pick<FilterState, 'hasReminders'> {
  return { hasReminders };
}

export function setApproachingRedEnabled(
  filter: FilterState,
  enabled: boolean = !filter.approachingRed.enabled,
): Pick<FilterState, 'approachingRed'> {
  return {
    approachingRed: {
      ...filter.approachingRed,
      enabled,
    },
  };
}

export function setApproachingRedWindow(
  filter: FilterState,
  windowMinutes: number,
): Pick<FilterState, 'approachingRed'> {
  return {
    approachingRed: {
      ...filter.approachingRed,
      windowMinutes,
    },
  };
}


