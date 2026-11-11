'use client';

import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import type {TaskRunRecord} from '../../context/taskWorkspaceState';
import styles from './TaskOutput.module.css';

type OutputView = 'tests' | 'console';

type TaskOutputProps = {
    readonly taskId: string | undefined;
    readonly record: TaskRunRecord | undefined;
};

function hasValidCounts(record: TaskRunRecord) {
    const {passedCount, totalTests} = record.result;
    return Number.isInteger(passedCount) && Number.isInteger(totalTests) &&
        (passedCount ?? 0) >= 0 && (totalTests ?? 0) > 0 && (passedCount ?? 0) <= (totalTests ?? 0);
}

function consoleText(record: TaskRunRecord): string {
    const {result} = record;
    if (record.mode === 'run' && result.status === 'completed') return result.message;
    return [result.message, ...result.logs].filter(Boolean).join('\n\n');
}

function statusText(record: TaskRunRecord | undefined): string {
    if (!record) return 'No result';
    if (record.mode === 'test' && record.result.status === 'test-failed') return 'Stopped at the first failing test';
    if (record.result.status === 'runtime-error') return 'Runtime error';
    if (record.result.status === 'timeout') return 'Timed out';
    if (record.result.status === 'cancelled') return 'Run cancelled';
    return record.mode === 'test' ? 'Tests completed' : 'Run completed';
}

export default function TaskOutput({taskId, record}: TaskOutputProps) {
    const [view, setView] = useState<OutputView>('tests');
    const testsRef = useRef<HTMLButtonElement>(null);
    const consoleRef = useRef<HTMLButtonElement>(null);
    const uid = useId();
    const testsPanelId = `${uid}-tests`;
    const consolePanelId = `${uid}-console`;

    useEffect(() => {
        // A new task or run opens its relevant output view instead of retaining a tab from the previous result.
        setView(record?.mode === 'run' ? 'console' : 'tests');
    }, [taskId, record?.result.requestId]);

    const selectView = (next: OutputView) => setView(next);
    const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'tests' : event.key === 'End' ? 'console' : view === 'tests' ? 'console' : 'tests';
        selectView(next);
        (next === 'tests' ? testsRef : consoleRef).current?.focus();
    };

    const message = record?.result.message ?? 'Run code or tests to see output.';
    const testsMessage = record?.mode === 'run' ? 'Run results are available in Console.' : message;
    const count = record && record.mode === 'test' && hasValidCounts(record)
        ? `Passed: ${record.result.passedCount}/${record.result.totalTests}`
        : null;
    const terminalConsole = record ? consoleText(record) : 'No console output captured.';

    return (
        <section className={styles.outputPanel} aria-labelledby="taskOutputHeading">
            <h2 id="taskOutputHeading" className={styles.outputHeading}>Output</h2>
            <div className={styles.tabList} role="tablist" aria-label="Output view">
                <button
                    ref={testsRef}
                    type="button"
                    role="tab"
                    aria-selected={view === 'tests'}
                    aria-controls={testsPanelId}
                    id={`${uid}-tests-tab`}
                    className={styles.tab}
                    tabIndex={view === 'tests' ? 0 : -1}
                    onClick={() => selectView('tests')}
                    onKeyDown={handleTabKeyDown}
                >
                    Tests
                </button>
                <button
                    ref={consoleRef}
                    type="button"
                    role="tab"
                    aria-selected={view === 'console'}
                    aria-controls={consolePanelId}
                    id={`${uid}-console-tab`}
                    className={styles.tab}
                    tabIndex={view === 'console' ? 0 : -1}
                    onClick={() => selectView('console')}
                    onKeyDown={handleTabKeyDown}
                >
                    Console
                </button>
            </div>
            <div id={testsPanelId} role="tabpanel" aria-labelledby={`${uid}-tests-tab`} className={styles.panel} hidden={view !== 'tests'}>
                    <p className={styles.status}>{statusText(record)}</p>
                    {count && <p className={styles.count}>{count}</p>}
                    <pre className={styles.message} aria-live="polite">{testsMessage}</pre>
            </div>
            <div id={consolePanelId} role="tabpanel" aria-labelledby={`${uid}-console-tab`} className={styles.panel} hidden={view !== 'console'}>
                <p className={styles.status}>{statusText(record)}</p>
                <pre className={styles.message} aria-live="polite">{terminalConsole}</pre>
            </div>
        </section>
    );
}
