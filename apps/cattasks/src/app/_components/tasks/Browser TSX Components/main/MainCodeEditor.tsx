'use client';
import dynamic from 'next/dynamic';
import type {BeforeMount, OnMount} from '@monaco-editor/react';
import type {editor, IDisposable} from 'monaco-editor';
import {useTaskContext} from '../../context/TaskProvider';
import styles from './MainCodeEditor.module.css';
import MainBtnRunCode from "@/app/_components/tasks/Browser TSX Components/main/MainBtnRunCode";
import MainBtnTest from "@/app/_components/tasks/Browser TSX Components/main/MainBtnTest";
import {runIsolatedTask, type IsolatedTaskRequest, type IsolatedTaskResult} from "../../lib/IsolatedTaskRunner";
import {useCallback, useEffect, useRef} from "react";

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainCodeEditorProps = {
    readonly className?: string;
    readonly children?: React.ReactNode;
};

function encodeModelPathId(id: string): string {
    let encoded = '';
    for (let index = 0; index < id.length; index += 1) {
        const codeUnit = id.charCodeAt(index);
        const next = id.charCodeAt(index + 1);
        if (codeUnit >= 0xD800 && codeUnit <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) {
            encoded += encodeURIComponent(id.slice(index, index + 2));
            index += 1;
        } else if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
            // Preserve accepted malformed UTF-16 IDs without using them as URI input.
            encoded += `%u${codeUnit.toString(16).toUpperCase().padStart(4, '0')}`;
        } else {
            encoded += encodeURIComponent(id[index]);
        }
    }
    return encodeURIComponent(encoded);
}

export default function MainCodeEditor({className}: MainCodeEditorProps) {
    const {
        selectedTask,
        selectedWorkspace,
        setSelectedDraft,
        beginSelectedRun,
        completeRun,
    } = useTaskContext();
    const activeAbortController = useRef<AbortController | null>(null);
    const configuredJavaScriptDefaults = useRef<unknown>(null);
    const codeEditor = useRef<editor.IStandaloneCodeEditor | null>(null);
    const ownedModels = useRef(new Set<editor.ITextModel>());
    const modelChangeSubscription = useRef<IDisposable | null>(null);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            activeAbortController.current?.abort();
            modelChangeSubscription.current?.dispose();
            const activeModel = codeEditor.current?.getModel();
            for (const model of ownedModels.current) {
                if (model !== activeModel && !model.isDisposed()) model.dispose();
            }
            ownedModels.current.clear();
            codeEditor.current = null;
        };
    }, []);
    useEffect(() => () => activeAbortController.current?.abort(), [selectedTask?.id]);

    const execute = useCallback(async (mode: IsolatedTaskRequest['mode']): Promise<void> => {
        const token = beginSelectedRun(mode);
        if (!token) return;
        const requestId = `run-${token.selectionGeneration}-${token.runGeneration}`;
        let controller: AbortController | null = null;
        let result: IsolatedTaskResult;
        try {
            activeAbortController.current?.abort();
            controller = new AbortController();
            activeAbortController.current = controller;
            const request: IsolatedTaskRequest = {
                requestId,
                mode,
                code: selectedWorkspace?.draft ?? "",
                ...(mode === "test" ? {entryPoint: selectedTask?.entryPoint, tests: selectedTask?.tests} : {}),
            };
            result = await runIsolatedTask(request, controller.signal);
        } catch (error) {
            result = {
                requestId,
                status: "runtime-error",
                message: `Ошибка выполнения: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
                logs: [],
            };
        }
        if (mounted.current && !controller?.signal.aborted) completeRun(token, result);
    }, [beginSelectedRun, completeRun, selectedTask, selectedWorkspace]);

    const handleEditorChange = (editorValue: string | undefined) => {
        activeAbortController.current?.abort();
        const safeEditorValue = editorValue ?? '';
        setSelectedDraft(safeEditorValue);
    };

    const configureJavaScriptDefaults = useCallback<BeforeMount>((monaco) => {
        const {javascriptDefaults} = monaco.languages.typescript;
        if (configuredJavaScriptDefaults.current === javascriptDefaults) return;

        javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
        });
        javascriptDefaults.setCompilerOptions({
            allowNonTsExtensions: true,
            checkJs: false,
            target: monaco.languages.typescript.ScriptTarget.ES2020,
        });
        configuredJavaScriptDefaults.current = javascriptDefaults;
    }, []);

    const trackOwnedModel = useCallback<OnMount>((editorInstance) => {
        codeEditor.current = editorInstance;
        const registerCurrentModel = () => {
            const model = editorInstance.getModel();
            if (model) ownedModels.current.add(model);
        };

        registerCurrentModel();
        modelChangeSubscription.current?.dispose();
        modelChangeSubscription.current = editorInstance.onDidChangeModel(registerCurrentModel);
    }, []);

    const value = selectedWorkspace?.draft ?? "";
    const outputMessage = selectedWorkspace?.result?.result.message ?? 'Run code or tests to see output.';
    // Monaco decodes URI paths once, so task IDs are double-encoded for safe model paths.
    const modelPath = selectedTask
        ? `solution-${encodeModelPathId(selectedTask.id)}.js`
        : 'solution.js';

    return (
        <div className={styles.codeEditorContainer}>
            <section className={styles.solutionCard} aria-labelledby="taskSolutionHeading">
                <header className={styles.solutionHeader}>
                    <div>
                        <h2 id="taskSolutionHeading" className={styles.solutionHeading}>
                            <span className={styles.codeMarker} aria-hidden="true" />
                            Your solution
                        </h2>
                        <p className={styles.languageLabel}>JavaScript</p>
                    </div>
                    <div className={styles.buttonsRow}>
                        <MainBtnTest className={styles.btnTest} execute={execute} isDisabled={!selectedTask}/>
                        <MainBtnRunCode className={styles.btnRunCode} execute={execute}/>
                    </div>
                </header>

                <div className={`${styles.codeEditorFrame} ${className ?? ''}`}>
                    <Monaco
                        height="100%"
                        language="javascript"
                        path={modelPath}
                        beforeMount={configureJavaScriptDefaults}
                        onMount={trackOwnedModel}
                        value={value}
                        onChange={handleEditorChange}
                        theme="vs-light"
                        options={{
                            automaticLayout: true,
                            minimap: {enabled: false},
                            occurrencesHighlight: 'off',
                            wordWrap: 'on',
                            fontSize: 14,
                            tabSize: 2,
                            scrollBeyondLastLine: false,
                            padding: {top: 8, bottom: 8},
                            ariaLabel: 'User JavaScript code',
                        }}
                    />
                </div>

                <section className={styles.outputPanel} aria-labelledby="taskOutputHeading">
                    <h2 id="taskOutputHeading" className={styles.outputHeading}>Output</h2>
                    <pre className={styles.outputMessage} aria-live="polite">{outputMessage}</pre>
                </section>
            </section>
        </div>
    );
}
