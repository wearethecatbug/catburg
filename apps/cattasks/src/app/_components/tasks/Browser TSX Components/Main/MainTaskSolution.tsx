'use client';
import dynamic from 'next/dynamic';
import styles from './MainTaskSolution.module.css';
import {useTaskContext} from '../../Context/TaskProvider';

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainTaskSolutionProps = {
    readonly className?: string;
    // readonly children?: React.ReactNode;
};


export default function MainTaskSolution({className}: MainTaskSolutionProps) {
    const {
        selectedTask,
        setTaskSolution,
        showSolution,
        editorSolution,
        setEditorSolution,
    } = useTaskContext();

    console.log("showSolution" + showSolution)


    if (!showSolution) {
        return <div className={`${styles.mainTaskSolution} ${styles.hidden ?? ''} ${className ?? ''}`}/>;
    }

    return (
        <div className={`${styles.mainTaskSolution} ${className ?? ''}`}>
            <Monaco
                height="100%"
                language="javascript"
                path={selectedTask ? `solution-${selectedTask.id}.js` : 'solution.js'}
                beforeMount={(monaco: any) => {
                    const {javascriptDefaults} = monaco.languages.typescript;
                    javascriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                    });
                    javascriptDefaults.setCompilerOptions({
                        allowNonTsExtensions: true,
                        checkJs: false,
                        target: monaco.languages.typescript.ScriptTarget.ES2020,
                    });
                }}
                onMount={(editor: any) => {
                    editor.getAction('editor.action.formatDocument')?.run();
                }}
                value={editorSolution ?? selectedTask?.solution ?? 'No solution available.'}
                onChange={(v) => {
                    const next = v ?? '';
                    setEditorSolution(next);
                    if (selectedTask) setTaskSolution(selectedTask.id, next);
                }}
                theme="vs-light"
                options={{
                    readOnly: true,
                    automaticLayout: true,
                    minimap: {enabled: false},
                    wordWrap: 'on',
                    fontSize: 14,
                    tabSize: 2,
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
    );
}