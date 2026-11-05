'use client';

import {useEffect, useRef, useState} from 'react';
import {exportCustomTasks, parseCustomTask, preflightCustomTaskImport} from './customTaskTransfer';
import {CUSTOM_TASK_TOPICS} from './customTaskTypes';
import {useTaskContext} from '../context/TaskProvider';
import styles from './CustomTaskControls.module.css';

type FormValues = Record<'id' | 'title' | 'description' | 'entryPoint' | 'starterCode' | 'solution' | 'tests' | 'topic', string>;
const emptyForm: FormValues = {id: '', title: '', description: '', entryPoint: '', starterCode: '', solution: '', tests: '[]', topic: ''};
const fields: readonly [keyof FormValues, string, 'input' | 'textarea'][] = [
    ['id', 'Task ID', 'input'], ['title', 'Title', 'input'], ['description', 'Description', 'textarea'],
    ['entryPoint', 'Entry point', 'input'], ['starterCode', 'Starter code', 'textarea'],
    ['solution', 'Reference solution', 'textarea'], ['tests', 'Tests (JSON)', 'textarea'],
];

function fieldFromMessage(message: string): keyof FormValues | null {
    const match = /^custom task\.(id|title|description|entryPoint|starterCode|solution|tests|topic)/.exec(message);
    return match?.[1] as keyof FormValues | undefined ?? null;
}

export function CustomTaskControls() {
    const {tasks, customTasks, customStorageError, addCustomTasks, retryCustomStorage} = useTaskContext();
    const [isOpen, setIsOpen] = useState(false);
    const [values, setValues] = useState<FormValues>(emptyForm);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
    const [transferError, setTransferError] = useState<string | null>(null);
    const mounted = useRef(true);
    const importVersion = useRef(0);
    const newTaskButton = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            importVersion.current += 1;
        };
    }, []);

    const update = (field: keyof FormValues, value: string) => {
        setValues(current => ({...current, [field]: value}));
        setFieldErrors(current => ({...current, [field]: undefined}));
    };

    const focusField = (field: keyof FormValues) => {
        requestAnimationFrame(() => document.getElementById(`custom-task-${field}`)?.focus());
    };

    const closeForm = () => {
        setIsOpen(false);
        setFieldErrors({});
        requestAnimationFrame(() => newTaskButton.current?.focus());
    };

    const save = () => {
        let tests: unknown;
        try {
            tests = JSON.parse(values.tests);
        } catch {
            setFieldErrors({tests: 'Tests must be valid JSON.'});
            focusField('tests');
            return;
        }
        try {
            const {topic, ...taskValues} = values;
            const record = parseCustomTask({...taskValues, tests, ...(topic === '' ? {} : {topic})});
            if (addCustomTasks([record])) {
                setValues(emptyForm);
                setTransferError(null);
                closeForm();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Task could not be saved.';
            const field = fieldFromMessage(message);
            if (field) {
                setFieldErrors({[field]: message});
                focusField(field);
            }
            else setTransferError(message);
        }
    };

    const importTasks = async (file: File | undefined) => {
        if (!file) return;
        const request = ++importVersion.current;
        setTransferError(null);
        try {
            const text = await file.text();
            if (!mounted.current || request !== importVersion.current) return;
            const builtInIds = new Set(tasks.slice(0, tasks.length - customTasks.length).map(task => task.id));
            const savedIds = new Set(customTasks.map(task => task.id));
            const incoming = preflightCustomTaskImport(text, builtInIds, savedIds);
            if (!incoming.ok) {
                setTransferError(incoming.message);
                return;
            }
            if (!addCustomTasks(incoming.tasks)) return;
        } catch (error) {
            if (mounted.current && request === importVersion.current) {
                setTransferError(error instanceof Error ? error.message : 'Import could not be read.');
            }
        }
    };

    const exportTasks = () => {
        const blob = new Blob([exportCustomTasks(customTasks)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'cattasks-custom-tasks.json';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <section className={styles.controls} aria-label="Custom tasks">
            <div className={styles.actions}>
                <button ref={newTaskButton} type="button" onClick={() => setIsOpen(true)}>New task</button>
                <label className={styles.fileInput}>
                    <span>Import tasks JSON</span>
                    <input type="file" accept="application/json" onChange={event => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        void importTasks(file);
                    }}/>
                </label>
                <button type="button" onClick={exportTasks}>Export tasks</button>
            </div>
            {customStorageError && <div className={styles.storageError} role="alert"><p>{customStorageError}</p><button className={styles.retry} type="button" onClick={retryCustomStorage}>Retry storage</button></div>}
            {transferError && <p className={styles.notice} role="alert">{transferError}</p>}
            {isOpen && (
                <form className={styles.form} onSubmit={event => { event.preventDefault(); save(); }}>
                    {fields.map(([name, label, kind]) => {
                        const error = fieldErrors[name];
                        const id = `custom-task-${name}`;
                        const errorId = `${id}-error`;
                        return <label className={styles.field} key={name}>
                            <span>{label}</span>
                            {kind === 'textarea' ? <textarea id={id} value={values[name]} onChange={event => update(name, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}/> : <input id={id} value={values[name]} onChange={event => update(name, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}/>}
                            {error && <span className={styles.error} id={errorId} role="alert">{error}</span>}
                        </label>;
                    })}
                    <label className={styles.field}>
                        <span>Topic (optional)</span>
                        <select value={values.topic} onChange={event => update('topic', event.target.value)}>
                            <option value="">Uncategorized</option>
                            {CUSTOM_TASK_TOPICS.map(topic => <option key={topic} value={topic}>{topic}</option>)}
                        </select>
                    </label>
                    <div className={styles.formActions}>
                        <button type="submit">Save task</button>
                        <button type="button" onClick={closeForm}>Cancel</button>
                    </div>
                </form>
            )}
        </section>
    );
}
