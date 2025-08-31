'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import styles from './MainCodeEditor.module.css';

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainCodeEditorprops = {
    readonly className?: string;
    // readonly children?: React.ReactNode;
};


export default function MainCodeEditor({className}: MainCodeEditorprops) {
    const [code, setCode] = useState('// write code here');

    return (
        <div className={`${styles.codeEditorContainer} ${className ?? ''}`}>
            <Monaco
                height="100%"
                language="javascript"        // ← было "typescript"
                path="solution.js"           // полезно для воркера
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