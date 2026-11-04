'use client';
import {loadBuiltinTaskCatalog, type CatalogTask} from '@/app/_components/tasks/catalog/taskCatalog';
import {useCallback, useEffect, useState} from 'react';

let cache: readonly CatalogTask[] | null = null;
let pendingLoad: Promise<readonly CatalogTask[]> | null = null;

function loadCatalog(): Promise<readonly CatalogTask[]> {
    if (cache) return Promise.resolve(cache);
    if (!pendingLoad) {
        pendingLoad = loadBuiltinTaskCatalog().then(tasks => {
            cache = tasks;
            return tasks;
        }).finally(() => {
            pendingLoad = null;
        });
    }
    return pendingLoad;
}

export function useTasksArr() {
    const [tasks, setTasks] = useState<readonly CatalogTask[]>(cache ?? []);
    const [error, setError] = useState<Error | null>(null);

    const retry = useCallback(() => {
        setError(null);
        void loadCatalog().then(setTasks).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason : new Error('Не удалось загрузить каталог задач'));
        });
    }, []);

    useEffect(() => {
        retry();
    }, [retry]);

    return {tasks, error, retry};
}
