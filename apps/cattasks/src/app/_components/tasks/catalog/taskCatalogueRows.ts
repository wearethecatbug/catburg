import type {CatalogTask} from './taskCatalog';
import type {TaskWorkspaceState} from '../context/taskWorkspaceState';

export const TASK_TOPICS = ['Arrays', 'Strings', 'Numbers', 'Logic'] as const;
export type TaskTopic = (typeof TASK_TOPICS)[number] | 'Uncategorized';
export type TaskProgressStatus = 'Not started' | 'In progress' | 'Completed';

const builtInTopics = new Map<string, TaskTopic>([
    ['race', 'Numbers'],
    ['digitize', 'Arrays'],
    ['no-space', 'Strings'],
]);

export type TaskCatalogueRow = {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly topic: TaskTopic;
    readonly status: TaskProgressStatus;
    readonly isCurrent: boolean;
};

export function getBuiltInTaskTopic(id: string): TaskTopic {
    return builtInTopics.get(id) ?? 'Uncategorized';
}

function getTaskProgressStatus(state: TaskWorkspaceState, id: string): TaskProgressStatus {
    const workspace = state.workspaces.get(id);
    if (!workspace) return 'Not started';
    if (workspace.completedTestGeneration === workspace.draftGeneration) return 'Completed';
    return 'In progress';
}

export function getTaskCatalogueRows(tasks: readonly CatalogTask[], state: TaskWorkspaceState): readonly TaskCatalogueRow[] {
    return tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        topic: getBuiltInTaskTopic(task.id),
        status: getTaskProgressStatus(state, task.id),
        isCurrent: task.id === state.selectedId,
    }));
}
