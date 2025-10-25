'use client';
import dynamic from 'next/dynamic';
import {useEffect, useState} from 'react';
import {useTaskContext} from '../../Context/TaskProvider';
import styles from './MainCodeEditor.module.css';

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainCodeEditorProps = {
    readonly className?: string;
    // readonly children?: React.ReactNode;
};


export default function MainCodeEditor({className}: MainCodeEditorProps) {
    const {selectedTaskDescription} = useTaskContext();
    const [code, setCode] = useState(selectedTaskDescription?.solution ?? '// write code here');

    useEffect(() => {
        if (selectedTaskDescription?.solution != null) setCode(selectedTaskDescription.solution);
    }, [selectedTaskDescription]);

    return (
        <div className={`${styles.codeEditorContainer} ${className ?? ''}`}>
            <Monaco
                height="100%"
                language="javascript"        // ← было "typescript"
                path={selectedTaskDescription ? `solution-${selectedTaskDescription.id}.js` : 'solution.js'}           // include id so editor model differs per task
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
                value={code}
                onChange={(v) => setCode(v ?? '')}
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