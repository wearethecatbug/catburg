'use client';
import dynamic from 'next/dynamic';
import {useTaskContext} from '../../Context/TaskProvider';
import styles from './MainCodeEditor.module.css';

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainCodeEditorProps = {
    readonly className?: string;
    // readonly children?: React.ReactNode;
};


export default function MainCodeEditor({className}: MainCodeEditorProps) {
    const {selectedTask, showSolution, editorSolution, editorUserCode, setEditorUserCode} = useTaskContext();

    const value = editorUserCode ?? "";

    return (
        <div className={`${styles.codeEditorContainer} ${className ?? ''}`}>
            <Monaco
                height="100%"
                language="javascript"        // ← было "typescript"
                path={selectedTask ? `solution-${selectedTask.id}.js` : 'solution.js'}
                beforeMount={(monaco) => {
                    const {javascriptDefaults} = monaco.languages.typescript;
                    javascriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true, // оставить только синтаксис
                        // noSyntaxValidation: false,  // true — убрать всё
                    });
                    javascriptDefaults.setCompilerOptions({
                        allowNonTsExtensions: true,
                        checkJs: false,
                        target: monaco.languages.typescript.ScriptTarget.ES2020,
                    });

                    // monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    //     noSemanticValidation: true,  // оставить только синтаксис
                    //     // noSyntaxValidation: true,  // если нужно убрать всё
                    // });
                }}

                onMount={(editor) => {
                    // опционально авто-формат
                    editor.getAction('editor.action.formatDocument')?.run();
                }}
                value={value}
                onChange={(v) => setEditorUserCode(v ?? '')}
                theme="vs-light"
                options={{
                    automaticLayout: true,
                    minimap: {enabled: false},
                    wordWrap: 'on',
                    fontSize: 14,
                    tabSize: 2,
                    scrollBeyondLastLine: false,
                    padding: {top: 8, bottom: 8},

                }}
            />
        </div>
    );
}