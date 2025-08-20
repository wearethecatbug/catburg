'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import styles from './MainCodeEditor.module.css';

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});
// type MainCodeEditorprops = {
//     readonly className?: string;
//     readonly children?: React.ReactNode;
// };


export default function MainCodeEditor() {
    const [code, setCode] = useState('// write code here');

    return (
        <div className={styles.codeEditorContainer}>
            <Monaco
                height="100%"
                language="typescript"
                path="tasks.tsx"
                beforeMount={(monaco) => {
                    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,  // оставить только синтаксис
                        // noSyntaxValidation: true,  // если нужно убрать всё
                    });
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