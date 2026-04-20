import type { Task } from './task.types';

export interface TaskMetadataState {
  noteText: string;
  hasNoteText: boolean;
  isUrgentPriority: boolean;
}

export function getTaskMetadataState(task: Pick<Task, 'note' | 'priority'>): TaskMetadataState {
  const noteText = task.note?.trim() ?? '';

  return {
    noteText,
    hasNoteText: Boolean(noteText),
    isUrgentPriority: task.priority === 'urgent',
  };
}

