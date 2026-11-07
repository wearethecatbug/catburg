'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import type {BeforeMount, OnMount} from '@monaco-editor/react';
import styles from './MainTaskSolutionEditor.module.css';
import type {TaskSolution} from '../../catalog/taskCatalog';


const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainTaskSolutionEditorProps = {
    readonly value: string;
    readonly solution?: TaskSolution;
};

export default function MainTaskSolutionEditor({
                                                   value,
                                                   solution,
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
        (_editorInstance, monaco) => {
            monaco.editor.setTheme('catTasksTheme');
        },
        [],
    );

    return (
        <div className={styles.taskSolutionContainer}>
            <div className={styles.editor}>
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
