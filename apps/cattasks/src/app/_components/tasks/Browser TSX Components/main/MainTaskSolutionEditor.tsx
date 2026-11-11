'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import type {BeforeMount, OnMount} from '@monaco-editor/react';
import type {editor, IDisposable} from 'monaco-editor';
import styles from './MainTaskSolutionEditor.module.css';
import type {TaskSolution} from '../../catalog/taskCatalog';


const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});
const MIN_EDITOR_HEIGHT = 90;
const MAX_EDITOR_HEIGHT = 280;
const EDITOR_VERTICAL_PADDING = 16;

type MainTaskSolutionEditorProps = {
    readonly value: string;
    readonly solution?: TaskSolution;
};

export default function MainTaskSolutionEditor({
                                                   value,
                                                   solution,
                                               }: MainTaskSolutionEditorProps) {
    const [editorHeight, setEditorHeight] = React.useState(MIN_EDITOR_HEIGHT);
    const editorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null);
    const contentSizeListenerRef = React.useRef<IDisposable | null>(null);
    const layoutListenerRef = React.useRef<IDisposable | null>(null);
    const mountFrameRef = React.useRef<number | null>(null);

    const updateEditorHeight = React.useCallback((editorInstance = editorRef.current) => {
        if (!editorInstance || editorRef.current !== editorInstance) return;

        const nextHeight = Math.min(
            MAX_EDITOR_HEIGHT,
            Math.max(MIN_EDITOR_HEIGHT, Math.ceil(editorInstance.getContentHeight() + EDITOR_VERTICAL_PADDING)),
        );
        setEditorHeight(currentHeight => currentHeight === nextHeight ? currentHeight : nextHeight);
    }, []);

    React.useEffect(() => {
        const frame = requestAnimationFrame(() => updateEditorHeight());
        return () => cancelAnimationFrame(frame);
    }, [updateEditorHeight, value]);

    React.useEffect(() => () => {
        if (mountFrameRef.current !== null) cancelAnimationFrame(mountFrameRef.current);
        contentSizeListenerRef.current?.dispose();
        layoutListenerRef.current?.dispose();
        contentSizeListenerRef.current = null;
        layoutListenerRef.current = null;
        mountFrameRef.current = null;
        editorRef.current = null;
    }, []);

    const handleBeforeMount = React.useCallback<BeforeMount>((monaco) => {
        monaco.editor.defineTheme('catTasksTheme', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                // скроллбары
                'scrollbarSlider.background': '#129e1aa8',
                'scrollbarSlider.hoverBackground': '#129e1acc',
                'scrollbarSlider.activeBackground': '#129e1aff',
            },
        });
    }, []);

    const handleMount = React.useCallback<OnMount>(
        (editorInstance, monaco) => {
            monaco.editor.setTheme('catTasksTheme');
            if (mountFrameRef.current !== null) cancelAnimationFrame(mountFrameRef.current);
            contentSizeListenerRef.current?.dispose();
            layoutListenerRef.current?.dispose();
            editorRef.current = editorInstance;
            contentSizeListenerRef.current = editorInstance.onDidContentSizeChange(() => updateEditorHeight(editorInstance));
            layoutListenerRef.current = editorInstance.onDidLayoutChange(() => updateEditorHeight(editorInstance));
            // Monaco settles its first content measurement after layout, so measure on the next frame.
            mountFrameRef.current = requestAnimationFrame(() => {
                mountFrameRef.current = null;
                updateEditorHeight(editorInstance);
            });
        },
        [updateEditorHeight],
    );

    return (
        <div className={styles.taskSolutionContainer}>
            {solution && <h3 className={styles.label}>{solution.label}</h3>}
            <div className={styles.editor} style={{height: `${editorHeight}px`}}>
                <Monaco
                    height="100%"
                    value={value}
                    beforeMount={handleBeforeMount}
                    onMount={handleMount}
                    defaultLanguage="javascript"
                    options={{
                        automaticLayout: true,
                        autoIndent: 'keep',
                        detectIndentation: false,
                        insertSpaces: false,
                        tabSize: 4,
                        useTabStops: true,
                        wordWrap: 'on',
                        renderWhitespace: 'all',
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: 14,
                        lineHeight: 18,
                        minimap: {enabled: false},
                        readOnly: true,
                        domReadOnly: true,
                        occurrencesHighlight: 'off',
                        scrollBeyondLastLine: false,
                        scrollbar: {
                            vertical: 'visible',
                            horizontal: 'hidden',
                            useShadows: false,
                            verticalScrollbarSize: 10,
                            verticalSliderSize: 8,
                            verticalHasArrows: true,
                            arrowSize: 10,
                        },
                    }}
                />
            </div>
            {solution && <dl className={styles.complexity}><dt>Time complexity</dt><dd>{solution.timeComplexity}</dd><dt>Space complexity</dt><dd>{solution.spaceComplexity}</dd><dt>Rationale</dt><dd>{solution.rationale}</dd></dl>}
        </div>
    );
}
