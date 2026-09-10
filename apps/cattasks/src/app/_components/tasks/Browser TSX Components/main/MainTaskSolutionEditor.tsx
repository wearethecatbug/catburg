'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import type {BeforeMount, OnMount} from '@monaco-editor/react';
import styles from './MainTaskSolutionEditor.module.css';


const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainTaskSolutionEditorProps = {
    readonly value: string;
    readonly onChangeAction: (next: string) => void;
    readonly onMountAction?: OnMount;
};

export default function MainTaskSolutionEditor({
                                                   value,
                                                   onChangeAction,
                                                   onMountAction,
                                               }: MainTaskSolutionEditorProps) {
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

            if (onMountAction) {
                onMountAction(editorInstance, monaco);
            }
        },
        [onMountAction],
    );

    return (
        <div className={styles.taskSolutionContainer}>
            <Monaco
                value={value}
                onChange={(next) => onChangeAction(next ?? '')}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                defaultLanguage="javascript"
                options={{
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
                    scrollbar: {
                        vertical: 'visible',
                        horizontal: 'hidden',
                        useShadows: false,
                        verticalScrollbarSize: 10,
                        verticalSliderSize: 8,
                        // horizontalScrollbarSize: 22,
                        // horizontalSliderSize: 22,
                        verticalHasArrows: true,
                        arrowSize: 10,
                    },
                }}
            />
        </div>
    );
}
