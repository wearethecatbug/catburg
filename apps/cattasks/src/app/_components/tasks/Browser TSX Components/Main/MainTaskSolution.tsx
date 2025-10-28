'use client';
import dynamic from 'next/dynamic';
import styles from './MainTaskSolution.module.css';
import {useTaskContext} from '../../Context/TaskProvider';
import {useRef} from 'react';

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainTaskSolutionProps = { readonly className?: string };

export default function MainTaskSolution({className}: MainTaskSolutionProps) {
    const {selectedTask, showSolution, editorSolution} = useTaskContext();
    const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);


    // держим редактор смонтированным, скрываем стилем
    const isVisible = !!selectedTask && showSolution;

    return (
        <div className={`${styles.mainTaskSolution} ${className ?? ''}`}>
            <div
                className={styles.editorHost}
                style={{visibility: isVisible ? 'visible' : 'hidden'}}
                aria-hidden={!isVisible}
            >
                <Monaco
                    onMount={(editor) => {
                        editorRef.current = editor;
                    }}
                    height="100%"
                    width="100%"
                    defaultLanguage="javascript"
                    // НЕ задавать path — он создавал пустые модели
                    value={editorSolution}
                    options={{
                        readOnly: true,
                        minimap: {enabled: false},
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        padding: {top: 8, bottom: 8},
                        hover: {enabled: false},
                        occurrencesHighlight: 'off',
                        selectionHighlight: false,
                        renderValidationDecorations: 'off',
                        quickSuggestions: false,
                        suggestOnTriggerCharacters: false,
                        contextmenu: true,
                    }}
                />
            </div>
        </div>
    );
}