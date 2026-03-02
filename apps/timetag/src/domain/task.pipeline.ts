import {
  Task,
  FilterState,
  SortState,
  WorkspaceType,
} from './task.types';
import { getUrgencyLevel, isApproachingRed } from './task.urgency';

// ============================================================================
// Pipeline Query (input for the pipeline)
// ============================================================================
export interface PipelineQuery {
  workspace: WorkspaceType;
  filter: FilterState;
  sort: SortState;
  searchQuery: string;
}

// ============================================================================
// Single source of truth: Workspace → Status → Filter → Search → Sort
// ============================================================================

/**
 * Apply the full list processing pipeline.
 * Pure function — no side effects.
 */
export function applyPipeline(tasks: Task[], query: PipelineQuery): Task[] {
  let result = tasks;

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
    const urgency = getUrgencyLevel(t);
    return query.filter.urgency[urgency];
  });

  // 4. Approaching Red filter (if enabled, show only AR + red + overdue)
  if (query.filter.approachingRed.enabled) {
    result = result.filter(
      (t) =>
        isApproachingRed(t, query.filter.approachingRed.windowMinutes) ||
        getUrgencyLevel(t) === 'red' ||
        getUrgencyLevel(t) === 'overdue',
    );
  }

  // 5. Search filter
  if (query.searchQuery.trim()) {
    const q = query.searchQuery.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(q));
  }

  // 6. Sort
  result = [...result].sort((a, b) => {
    let cmp = 0;

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
    }

    return query.sort.direction === 'asc' ? cmp : -cmp;
  });

  return result;
}

