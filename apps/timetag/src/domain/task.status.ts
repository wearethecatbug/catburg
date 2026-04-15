import { Task, TaskStatus, TimerStatus } from './task.types';

// ============================================================================
// Status Transitions (deterministic, pure)
// ============================================================================

/** Valid status transitions */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  active: ['done', 'archived'],
  done: ['active', 'archived'],
  archived: ['active'], // Restore always returns to ACTIVE
};

/**
 * Check if a status transition is valid
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Compute the partial update for a status transition.
 * Returns null if transition is invalid.
 */
export function transitionStatus(
  task: Task,
  targetStatus: TaskStatus,
  nowIso: string,
): Partial<Task> | null {
  if (!canTransition(task.status, targetStatus)) {
    return null;
  }

  const updates: Partial<Task> = {
    status: targetStatus,
    updatedAt: nowIso,
  };

  // Pause timer when leaving active
  if (targetStatus !== 'active' && task.timerStatus === 'running') {
    updates.timerStatus = 'paused' as TimerStatus;
  }

  return updates;
}

/**
 * Toggle between active and done
 */
export function toggleDoneStatus(task: Task, nowIso: string): Partial<Task> | null {
  if (task.status === 'active') {
    return transitionStatus(task, 'done', nowIso);
  }
  if (task.status === 'done') {
    return transitionStatus(task, 'active', nowIso);
  }
  return null;
}

