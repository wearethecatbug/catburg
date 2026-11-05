import {exportCustomTasks, parseCustomTask, preflightCustomTaskImport, validateCustomTaskRecords} from './customTaskTransfer';
import type {CustomTaskRecord, CustomTaskResult} from './customTaskTypes';

export const CUSTOM_TASK_STORAGE_KEY = 'cattasks.custom-tasks.v1';
type CustomTaskStorage = Pick<Storage, 'getItem' | 'setItem'>;

function storageFailure(error: unknown): CustomTaskResult {
    return {ok: false, message: error instanceof Error ? error.message : 'Custom task storage is unavailable'};
}

export function loadCustomTasks(storage: CustomTaskStorage, builtInIds: ReadonlySet<string>): CustomTaskResult {
    let raw: string | null;
    try {
        raw = storage.getItem(CUSTOM_TASK_STORAGE_KEY);
    } catch (error) {
        return storageFailure(error);
    }
    return raw === null ? {ok: true, tasks: []} : preflightCustomTaskImport(raw, builtInIds, new Set());
}

export function appendCustomTasks(
    storage: CustomTaskStorage,
    incoming: readonly CustomTaskRecord[],
    builtInIds: ReadonlySet<string>,
): CustomTaskResult {
    const saved = loadCustomTasks(storage, builtInIds);
    if (!saved.ok) return saved;
    try {
        if (incoming.length === 0) return saved;
        const savedIds = new Set(saved.tasks.map(task => task.id));
        const validatedIncoming = incoming.map(parseCustomTask);
        validateCustomTaskRecords(validatedIncoming, builtInIds, savedIds);
        const tasks = [...saved.tasks, ...validatedIncoming];
        storage.setItem(CUSTOM_TASK_STORAGE_KEY, exportCustomTasks(tasks));
        return {ok: true, tasks};
    } catch (error) {
        return storageFailure(error);
    }
}
