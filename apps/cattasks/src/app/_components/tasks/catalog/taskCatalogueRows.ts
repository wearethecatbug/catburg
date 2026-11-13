import type {CatalogTask} from './taskCatalog';
import type {TaskWorkspaceState} from '../context/taskWorkspaceState';
import type {CustomTaskTopic} from '../customTasks/customTaskTypes';
import type {TaskDifficulty} from './taskCatalog';

export const TASK_TOPICS = ['Arrays', 'Strings', 'Numbers', 'Logic'] as const;
export type TaskTopic = (typeof TASK_TOPICS)[number] | 'Uncategorized';
export type TaskProgressStatus = 'Not started' | 'In progress' | 'Completed';

// Built-in topics stay in this projection layer so imported records retain their own topic ownership.
const builtInTopics = new Map<string, TaskTopic>([
    ['race', 'Numbers'],
    ['digitize', 'Arrays'],
    ['no-space', 'Strings'],
    ['ct-js-01', 'Strings'], ['ct-js-02', 'Strings'], ['ct-js-05', 'Strings'], ['ct-js-06', 'Strings'],
    ['ct-js-11', 'Strings'], ['ct-js-21', 'Strings'], ['ct-js-26', 'Strings'], ['ct-js-27', 'Strings'],
    ['ct-js-31', 'Strings'], ['ct-js-33', 'Strings'], ['ct-js-34', 'Strings'], ['ct-js-44', 'Strings'], ['ct-js-46', 'Strings'],
    ['ct-js-03', 'Numbers'], ['ct-js-08', 'Numbers'], ['ct-js-19', 'Numbers'], ['ct-js-24', 'Numbers'], ['ct-js-25', 'Numbers'],
    ['ct-js-04', 'Arrays'], ['ct-js-07', 'Arrays'], ['ct-js-09', 'Arrays'], ['ct-js-10', 'Arrays'],
    ['ct-js-12', 'Arrays'], ['ct-js-13', 'Arrays'], ['ct-js-14', 'Arrays'], ['ct-js-15', 'Arrays'],
    ['ct-js-16', 'Arrays'], ['ct-js-17', 'Arrays'], ['ct-js-18', 'Arrays'], ['ct-js-20', 'Arrays'],
    ['ct-js-28', 'Arrays'], ['ct-js-29', 'Arrays'], ['ct-js-30', 'Arrays'], ['ct-js-32', 'Arrays'],
    ['ct-js-40', 'Arrays'], ['ct-js-41', 'Arrays'], ['ct-js-42', 'Arrays'], ['ct-js-43', 'Arrays'],
    ['ct-js-22', 'Logic'], ['ct-js-23', 'Logic'], ['ct-js-35', 'Logic'], ['ct-js-36', 'Logic'],
    ['ct-js-37', 'Logic'], ['ct-js-38', 'Logic'], ['ct-js-39', 'Logic'], ['ct-js-45', 'Logic'],
    ['ct-js-47', 'Logic'], ['ct-js-48', 'Logic'], ['ct-js-49', 'Logic'], ['ct-js-50', 'Logic'],
]);

export type TaskCatalogueRow = {
    readonly id: string;
    readonly ordinal: number;
    readonly title: string;
    readonly description: string;
    readonly topic: TaskTopic;
    readonly status: TaskProgressStatus;
    readonly isCurrent: boolean;
    readonly difficulty: TaskDifficulty | 'Unrated';
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

export function getTaskCatalogueRows(
    tasks: readonly CatalogTask[],
    state: TaskWorkspaceState,
    customTopics: ReadonlyMap<string, CustomTaskTopic | undefined> = new Map(),
): readonly TaskCatalogueRow[] {
    return tasks.map(task => ({
        id: task.id,
        ordinal: task.ordinal,
        title: task.title,
        description: task.description,
        topic: customTopics.has(task.id) ? customTopics.get(task.id) ?? 'Uncategorized' : getBuiltInTaskTopic(task.id),
        status: getTaskProgressStatus(state, task.id),
        isCurrent: task.id === state.selectedId,
        difficulty: task.difficulty ?? 'Unrated',
    }));
}
