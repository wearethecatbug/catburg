import {exportCustomTasks, parseCustomTask, preflightCustomTaskImport, validateCustomTaskRecords} from './customTaskTransfer';
import type {CustomTaskRecord, CustomTaskResult} from './customTaskTypes';

export const CUSTOM_TASK_STORAGE_KEY = 'cattasks.custom-tasks.v1';
const CUSTOM_TASK_DATABASE = 'cattasks.custom-tasks';
const CUSTOM_TASK_STORE = 'documents';
const CUSTOM_TASK_DOCUMENT_KEY = 'v1';

type LegacyCustomTaskStorage = Pick<Storage, 'getItem'>;
type StoredDocument = { readonly exists: boolean; readonly result?: CustomTaskResult };

function storageFailure(error: unknown): CustomTaskResult {
    return {ok: false, message: error instanceof Error ? error.message : 'Custom task storage is unavailable'};
}

function cancelled(): CustomTaskResult {
    return {ok: false, message: 'Custom task save was cancelled'};
}

function readDocument(raw: unknown, builtInIds: ReadonlySet<string>): CustomTaskResult {
    if (typeof raw !== 'string') return {ok: false, message: 'Custom task storage document is invalid'};
    return preflightCustomTaskImport(raw, builtInIds, new Set());
}

function openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Custom task storage is unavailable'));
    return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        const request = indexedDB.open(CUSTOM_TASK_DATABASE, 1);
        request.onupgradeneeded = () => {
            if (settled) {
                try {
                    request.transaction?.abort();
                } catch {
                    request.result.close();
                }
                return;
            }
            try {
                if (!request.result.objectStoreNames.contains(CUSTOM_TASK_STORE)) {
                    request.result.createObjectStore(CUSTOM_TASK_STORE);
                }
            } catch (error) {
                fail(error instanceof Error ? error : new Error('Custom task storage is unavailable'));
                try {
                    request.transaction?.abort();
                } catch {
                    request.result.close();
                }
            }
        };
        request.onblocked = () => fail(new Error('Custom task storage is blocked'));
        request.onerror = () => fail(request.error ?? new Error('Custom task storage is unavailable'));
        request.onsuccess = () => {
            const database = request.result;
            database.onversionchange = () => database.close();
            if (settled) {
                database.close();
                return;
            }
            settled = true;
            resolve(database);
        };
    });
}

function readCurrentDocument(database: IDBDatabase, builtInIds: ReadonlySet<string>): Promise<StoredDocument> {
    return new Promise(resolve => {
        let result: StoredDocument = {exists: false};
        const transaction = database.transaction(CUSTOM_TASK_STORE, 'readonly');
        const request = transaction.objectStore(CUSTOM_TASK_STORE).get(CUSTOM_TASK_DOCUMENT_KEY);
        request.onsuccess = () => {
            result = request.result === undefined
                ? {exists: false}
                : {exists: true, result: readDocument(request.result, builtInIds)};
        };
        request.onerror = () => {
            result = {exists: true, result: storageFailure(request.error)};
        };
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => resolve({exists: true, result: storageFailure(transaction.error)});
        transaction.onerror = () => undefined;
    });
}

function initializeDocument(
    database: IDBDatabase,
    document: string,
    builtInIds: ReadonlySet<string>,
): Promise<CustomTaskResult> {
    return new Promise(resolve => {
        const prepared = readDocument(document, builtInIds);
        if (!prepared.ok) {
            resolve(prepared);
            return;
        }
        let success: CustomTaskResult | null = null;
        let failure: CustomTaskResult | null = null;
        const transaction = database.transaction(CUSTOM_TASK_STORE, 'readwrite');
        const store = transaction.objectStore(CUSTOM_TASK_STORE);
        const request = store.get(CUSTOM_TASK_DOCUMENT_KEY);
        request.onsuccess = () => {
            if (request.result !== undefined) {
                const existing = readDocument(request.result, builtInIds);
                if (existing.ok) success = existing;
                else failure = existing;
                return;
            }
            try {
                const write = store.put(document, CUSTOM_TASK_DOCUMENT_KEY);
                write.onsuccess = () => {
                    success = prepared;
                };
                write.onerror = () => {
                    failure = storageFailure(write.error);
                };
            } catch (error) {
                failure = storageFailure(error);
                try {
                    transaction.abort();
                } catch {
                    // The transaction may already be finishing.
                }
            }
        };
        request.onerror = () => {
            failure = storageFailure(request.error);
        };
        transaction.oncomplete = () => resolve(success ?? failure ?? storageFailure(new Error('Custom task storage is unavailable')));
        transaction.onabort = () => resolve(failure ?? storageFailure(transaction.error));
        transaction.onerror = () => undefined;
    });
}

export async function loadCustomTasks(
    getLegacyStorage: () => LegacyCustomTaskStorage,
    builtInIds: ReadonlySet<string>,
): Promise<CustomTaskResult> {
    let database: IDBDatabase | null = null;
    try {
        database = await openDatabase();
        const stored = await readCurrentDocument(database, builtInIds);
        if (stored.exists) return stored.result ?? storageFailure(new Error('Custom task storage is unavailable'));
        const raw = getLegacyStorage().getItem(CUSTOM_TASK_STORAGE_KEY);
        const document = raw ?? exportCustomTasks([]);
        const migrated = readDocument(document, builtInIds);
        if (!migrated.ok) return migrated;
        return await initializeDocument(database, document, builtInIds);
    } catch (error) {
        return storageFailure(error);
    } finally {
        database?.close();
    }
}

export async function getCustomTaskExport(builtInIds: ReadonlySet<string>): Promise<CustomTaskResult> {
    let database: IDBDatabase | null = null;
    try {
        database = await openDatabase();
        const stored = await readCurrentDocument(database, builtInIds);
        return stored.exists
            ? stored.result ?? storageFailure(new Error('Custom task storage is unavailable'))
            : {ok: false, message: 'Custom task storage is not initialized'};
    } catch (error) {
        return storageFailure(error);
    } finally {
        database?.close();
    }
}

export async function appendCustomTasks(
    incoming: readonly CustomTaskRecord[],
    builtInIds: ReadonlySet<string>,
    signal?: AbortSignal,
): Promise<CustomTaskResult> {
    if (signal?.aborted) return cancelled();
    if (incoming.length === 0) return getCustomTaskExport(builtInIds);
    let database: IDBDatabase | null = null;
    try {
        database = await openDatabase();
        if (signal?.aborted) return cancelled();
        const activeDatabase = database;
        return await new Promise<CustomTaskResult>(resolve => {
            let success: CustomTaskResult | null = null;
            let failure: CustomTaskResult | null = null;
            const transaction = activeDatabase.transaction(CUSTOM_TASK_STORE, 'readwrite');
            const store = transaction.objectStore(CUSTOM_TASK_STORE);
            const abort = () => {
                try {
                    transaction.abort();
                } catch {
                    // The transaction may already be finishing.
                }
            };
            signal?.addEventListener('abort', abort, {once: true});
            const finish = (value: CustomTaskResult) => {
                signal?.removeEventListener('abort', abort);
                resolve(value);
            };
            const request = store.get(CUSTOM_TASK_DOCUMENT_KEY);
            request.onsuccess = () => {
                if (signal?.aborted) {
                    failure = cancelled();
                    abort();
                    return;
                }
                const saved = request.result === undefined
                    ? {ok: false, message: 'Custom task storage is not initialized'} as CustomTaskResult
                    : readDocument(request.result, builtInIds);
                if (!saved.ok) {
                    failure = saved;
                    abort();
                    return;
                }
                try {
                    const savedIds = new Set(saved.tasks.map(task => task.id));
                    const validatedIncoming = incoming.map(parseCustomTask);
                    validateCustomTaskRecords(validatedIncoming, builtInIds, savedIds);
                    const tasks = [...saved.tasks, ...validatedIncoming];
                    const next = {ok: true, tasks} as const;
                    const write = store.put(exportCustomTasks(tasks), CUSTOM_TASK_DOCUMENT_KEY);
                    write.onsuccess = () => {
                        success = next;
                    };
                    write.onerror = () => {
                        failure = storageFailure(write.error);
                    };
                } catch (error) {
                    failure = storageFailure(error);
                    abort();
                }
            };
            request.onerror = () => {
                failure = storageFailure(request.error);
            };
            transaction.oncomplete = () => finish(success ?? failure ?? storageFailure(new Error('Custom task storage is unavailable')));
            transaction.onabort = () => finish(failure ?? (signal?.aborted ? cancelled() : storageFailure(transaction.error)));
            transaction.onerror = () => undefined;
        });
    } catch (error) {
        return storageFailure(error);
    } finally {
        database?.close();
    }
}
