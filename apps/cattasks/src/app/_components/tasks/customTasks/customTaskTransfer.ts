import {CatalogValidationError, parseTaskDefinition} from '../catalog/taskCatalog';
import {CUSTOM_TASK_TOPICS, type CustomTaskRecord, type CustomTaskResult, type CustomTaskTopic} from './customTaskTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCustomTaskTopic(value: unknown): value is CustomTaskTopic {
    return typeof value === 'string' && CUSTOM_TASK_TOPICS.includes(value as CustomTaskTopic);
}

export function parseCustomTask(value: unknown): CustomTaskRecord {
    const task = parseTaskDefinition(value, 'custom task');
    if (!isRecord(value) || !('topic' in value) || value.topic === undefined) return task;
    if (!isCustomTaskTopic(value.topic)) {
        throw new CatalogValidationError('custom task.topic: must be Arrays, Strings, Numbers, or Logic');
    }
    return {...task, topic: value.topic};
}

function readCustomTaskDocument(value: unknown): readonly CustomTaskRecord[] {
    if (!isRecord(value)) throw new CatalogValidationError('custom tasks: must be an object');
    if (value.version !== 1) throw new CatalogValidationError('custom tasks.version: must equal 1');
    if (!Array.isArray(value.tasks)) throw new CatalogValidationError('custom tasks.tasks: must be an array');
    return value.tasks.map(parseCustomTask);
}

export function validateCustomTaskRecords(
    tasks: readonly CustomTaskRecord[],
    builtInIds: ReadonlySet<string>,
    savedIds: ReadonlySet<string>,
): void {
    const ids = new Set<string>();
    for (const task of tasks) {
        if (ids.has(task.id)) throw new CatalogValidationError(`custom tasks: duplicate id '${task.id}'`);
        if (builtInIds.has(task.id)) throw new CatalogValidationError(`custom tasks: id '${task.id}' collides with a built-in task`);
        if (savedIds.has(task.id)) throw new CatalogValidationError(`custom tasks: id '${task.id}' already exists`);
        ids.add(task.id);
    }
}

export function preflightCustomTaskImport(
    text: string,
    builtInIds: ReadonlySet<string>,
    savedIds: ReadonlySet<string>,
): CustomTaskResult {
    try {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new CatalogValidationError('custom tasks: JSON is invalid');
        }
        const tasks = readCustomTaskDocument(parsed);
        validateCustomTaskRecords(tasks, builtInIds, savedIds);
        return {ok: true, tasks};
    } catch (error) {
        return {ok: false, message: error instanceof Error ? error.message : 'Custom tasks could not be imported'};
    }
}

export function exportCustomTasks(tasks: readonly CustomTaskRecord[]): string {
    return JSON.stringify({version: 1, tasks});
}
