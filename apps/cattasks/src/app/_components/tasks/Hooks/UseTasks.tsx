'use client';
import type {ParsedTask} from '@/app/_components/tasks/lib/ParseTasksArr';
import {parseTasksArr} from '@/app/_components/tasks/lib/ParseTasksArr';
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