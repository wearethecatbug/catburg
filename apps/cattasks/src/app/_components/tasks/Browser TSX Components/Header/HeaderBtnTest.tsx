"use client";
import React, {useEffect, useState} from 'react';
import styles from './HeaderBtnTest.module.css';
import {useTaskContext} from "../../Context/TaskProvider";


function deepEqual(a: unknown, b: unknown) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function compileUserFunction(userCode: string): { fn?: (...a: unknown[]) => unknown; errorMessage?: string } {
    try {
        const factory = new Function(
            `"use strict";
       let __out;
       const module = { exports: {} };
       const exports = module.exports;
       let defaultExport;
       globalThis.__solution__ = undefined;

       ;(function(){\n${userCode}\n})(); // изолируем топ-уровень

       return (
         (typeof __out === "function" && __out) ||
         (typeof module.exports === "function" && module.exports) ||
         (typeof exports === "function" && exports) ||
         (typeof defaultExport === "function" && defaultExport) ||
         (typeof globalThis.__solution__ === "function" && globalThis.__solution__)
       );
      `
        );
        const fn = factory();
        if (typeof fn !== "function") return {errorMessage: "Функция не найдена. Экспортируйте её: export default / module.exports / globalThis.__solution__."};
        return {fn};
    } catch (e) {
        return {errorMessage: e instanceof Error ? e.message : String(e)};
    }
}

function parseArguments(argumentsSource: string): unknown[] {
    try {
        return new Function(`return [${argumentsSource}]`)();
    } catch {
        return [];
    }
}

function executeTests(
    userFunction: (...a: unknown[]) => unknown,
    tests: { arguments: string; result: unknown }[]
): { passed: number; total: number; runtimeErrors: number } {
    let passed = 0;
    let runtimeErrors = 0;
    for (const t of tests) {
        try {
            const args = parseArguments(t.arguments);
            const received = userFunction(...args);
            if (deepEqual(received, t.result)) passed += 1;
        } catch {
            runtimeErrors += 1;
        }
    }
    return {passed, total: tests.length, runtimeErrors};
}

interface HeaderBtnTestProps {
    readonly className?: string;
    // readonly children?: React.ReactNode;
    readonly code?: string; // optional code content to use
}

export default function HeaderBtnTest({className, code}: HeaderBtnTestProps) {
    const {
        runTest, setRunTest,
        validSolution, setValidSolution,
        selectedTask, editorUserCode
    } = useTaskContext();

    const [isTestInfoVisible, setIsTestInfoVisible] = useState(false);
    const [testNotificationText, setTestNotificationText] = useState<string | null>(null);
    const [lastRunStatus, setLastRunStatus] = useState<'idle' | 'passed' | 'failed' | 'error'>('idle');

    const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);
    const isDisabled = !selectedTask;
    const tests = selectedTask?.tests ?? [];
    //
    // const handleClick = () => {
    //     if (isDisabled) return;
    //     setRunTest(!runTest);
    // }

    useEffect(() => {
        if (!runTest) return;

        setIsTestInfoVisible(true);
        setTestNotificationText(null);
        setLastRunStatus('idle');

        const compiled = compileUserFunction(editorUserCode);
        if (compiled.errorMessage) {
            setValidSolution(false);
            setLastRunStatus('error');
            setTestNotificationText(`Синтаксическая ошибка: ${compiled.errorMessage}`);
            setRunTest(false);
            return;
        }

        let passed = 0;
        let runtimeErrors = 0;
        for (const t of tests as any[]) {
            try {
                const args = parseArguments(t.arguments);
                const received = compiled.fn!(...args);
                if (deepEqual(received, t.result)) passed += 1;
            } catch {
                runtimeErrors += 1;
            }
        }

        if (runtimeErrors > 0) {
            setValidSolution(false);
            setLastRunStatus('error');
            setTestNotificationText(`Ошибки выполнения тестов: ${runtimeErrors}`);
        } else if ((tests as any[]).length > 0 && passed === (tests as any[]).length) {
            setValidSolution(true);
            setLastRunStatus('passed');
            setTestNotificationText(`Все тесты пройдены: ${passed}/${(tests as any[]).length}`);
        } else {
            setValidSolution(false);
            setLastRunStatus('failed');
            setTestNotificationText(`Тесты не пройдены: ${passed}/${(tests as any[]).length}`);
        }

        setRunTest(false);
    }, [runTest, editorUserCode, tests, setValidSolution, setRunTest]);

    const getBtnTestClass = [
        styles.headerBtnTest,
        runTest ? styles.active : '',
        isDisabled ? styles.headerBtnTestDisabled : '',
        className ?? ''
    ].join(' ');


    const getBtnInfoClass = [
        styles.headerBtnTestInfo,
        lastRunStatus === 'passed' ? styles.headerBtnTestInfoSuccess : '',
        (lastRunStatus === 'failed' || lastRunStatus === 'error') ? styles.headerBtnTestInfoError : '',
        className ?? ''
    ].join(' ');


    return (
        <div className={styles.headerBtnTestContainer}>
            <button
                type="button"
                className={getBtnTestClass}
                onClick={() => {
                    if (!isDisabled) setRunTest(true);
                }}
                aria-pressed={runTest}
                aria-disabled={isDisabled}
                disabled={isDisabled}
            />
            <button
                type="button"
                className={getBtnInfoClass}
                onClick={() => setIsTestInfoVisible(v => !v)}
                aria-expanded={isTestInfoVisible}
                aria-label="Показать информацию о тестах"
                disabled={lastRunStatus === 'idle'}
                aria-disabled={lastRunStatus === 'idle'}
            >
                INFO
            </button>

            <div
                className={`${styles.headerBtnTestErrorText} ${
                    isTestInfoVisible && testNotificationText ? '' : styles.headerBtnTestErrorHidden
                }`}
                aria-hidden={!(isTestInfoVisible && !!testNotificationText)}
            >
                {testNotificationText ?? ''}
            </div>
        </div>
    );
}