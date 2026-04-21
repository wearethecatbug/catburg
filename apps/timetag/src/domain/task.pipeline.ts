import {
  Task,
  FilterState,
  SortState,
  WorkspaceType,
} from './task.types';
import { supportsTimer, supportsUrgency } from './task.mode';
import { getUrgencyLevel, isApproachingRed } from './task.urgency';

// ============================================================================
// Pipeline Query (input for the pipeline)
// ============================================================================
export interface PipelineQuery {
  workspace: WorkspaceType;
  filter: FilterState;
  sort: SortState;
  searchQuery: string;
  showCompletedTasks: boolean;
}

export function createPipelineQuery(
  queryState: Pick<PipelineQuery, 'workspace' | 'filter' | 'sort' | 'searchQuery'>,
  showCompletedTasks: boolean,
): PipelineQuery {
  return {
    ...queryState,
    showCompletedTasks,
  };
}

// ============================================================================
// Single source of truth: Workspace → Status → Filter → Search → Sort
// ============================================================================

/**
 * Legacy persisted tasks may miss priority; default to normal to keep them visible.
 */
const getTaskPriority = (task: Task) => task.priority ?? 'normal';

function compareTimedTasksFirst(a: Task, b: Task): number {
  const aIsTimed = supportsTimer(a.timerMode);
  const bIsTimed = supportsTimer(b.timerMode);

  if (aIsTimed === bIsTimed) {
    return 0;
  }

  return aIsTimed ? -1 : 1;
}

/**
 * Apply the full list processing pipeline.
 * Pure function — no side effects.
 */
export function applyPipeline(tasks: Task[], query: PipelineQuery): Task[] {
  let result = tasks;

  if (!query.showCompletedTasks) {
    result = result.filter((task) => task.status === 'active');
  }

  // 1. Workspace filter
  if (query.workspace !== 'all') {
    result = result.filter((t) => t.workspace === query.workspace);
  }

  // 2. Status filter
  if (query.filter.status !== 'all') {
    result = result.filter((t) => t.status === query.filter.status);
  }

  // 3. Urgency filter
  result = result.filter((t) => {
    if (!supportsUrgency(t.timerMode)) {
      return true;
    }

    const urgency = getUrgencyLevel(t);
    return query.filter.urgency[urgency];
  });

  // 4. Priority filter
  result = result.filter((t) => query.filter.priority[getTaskPriority(t)]);

  // 5. Approaching Red filter (if enabled, show only AR + red + overdue)
  if (query.filter.approachingRed.enabled) {
    result = result.filter(
      (t) =>
        supportsUrgency(t.timerMode) && (
          isApproachingRed(t, query.filter.approachingRed.windowMinutes) ||
          getUrgencyLevel(t) === 'danger' ||
          getUrgencyLevel(t) === 'overdue'
        ),
    );
  }

  // 6. Mode filter (show only tasks with selected timer modes)
  const modesSelected = Object.values(query.filter.mode).some((v) => v);
  if (modesSelected) {
    result = result.filter((t) => query.filter.mode[t.timerMode]);
  }

  // 7. Reminders filter
  if (query.filter.hasReminders && query.filter.hasReminders !== 'any') {
    result = result.filter((t) => {
      const hasReminders = t.reminders.length > 0;
      return query.filter.hasReminders === 'yes' ? hasReminders : !hasReminders;
    });
  }

  // 8. Search filter
  if (query.searchQuery.trim()) {
    const q = query.searchQuery.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(q));
  }

  // 9. Sort
  result = [...result].sort((a, b) => {
    let cmp = 0;

    if (query.sort.field === 'remainingSec') {
      const timedCmp = compareTimedTasksFirst(a, b);
      if (timedCmp !== 0) {
        return timedCmp;
      }
    }

    switch (query.sort.field) {
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'remainingSec':
        cmp = a.remainingSec - b.remainingSec;
        break;
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'priority': {
        // Sort: 'urgent' (0) before 'normal' (1)
        const priorityOrder = { urgent: 0, normal: 1 };
        cmp = priorityOrder[getTaskPriority(a)] - priorityOrder[getTaskPriority(b)];
        break;
      }
    }

    return query.sort.direction === 'asc' ? cmp : -cmp;
  });

  return result;
}

