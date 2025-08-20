'use client';
import type {ParsedTask} from './ParseTasksArr';
import {parseTasksArr} from './ParseTasksArr';
import {useEffect, useState} from 'react';

let cache: ParsedTask[] | null = null;

export function useTasksArr() {
    const [tasks, setTasks] = useState<ParsedTask[]>(cache ?? []); // ← не null

    useEffect(() => {
        if (cache) return setTasks(cache);
        fetch('/tasks.txt').then(r => r.text()).then(text => {
            const parsed = parseTasksArr(text);
            cache = parsed;
            setTasks(parsed); // всегда ParsedTask[]
        });
    }, []);

    return tasks;
}