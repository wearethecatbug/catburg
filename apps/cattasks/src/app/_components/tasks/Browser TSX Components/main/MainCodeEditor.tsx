'use client';
import dynamic from 'next/dynamic';
import {useTaskContext} from '../../context/TaskProvider';
import styles from './MainCodeEditor.module.css';
import MainBtnRunCode from "@/app/_components/tasks/Browser TSX Components/main/MainBtnRunCode";
import MainBtnTest from "@/app/_components/tasks/Browser TSX Components/main/MainBtnTest";

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

type MainCodeEditorProps = {
    readonly className?: string;
    readonly children?: React.ReactNode;
};

export default function MainCodeEditor({className}: MainCodeEditorProps) {
    const {
        selectedTask,
        editorUserCode,
        setEditorUserCode,
        setRunTest,
        setValidSolution,
        setTestNotificationText,
    } = useTaskContext();

    const handleEditorChange = (v: string | undefined) => {
        setEditorUserCode(value ?? '');
        // сброс состояния тестов — вернёт MainBtnTest в styles.default
        setRunTest?.(false);
        setValidSolution?.(false);
        // очищаем текст в инфо-вкладке
        setTestNotificationText?.('');
    };

    const value = editorUserCode ?? "";

    return (
        <>
            <div className={styles.container}>

                <div className={styles.buttonsRow}>
                    <MainBtnTest className={styles.btnTest}/>
                    <MainBtnRunCode className={styles.btnRunCode}/>
                </div>

                <div className={`${styles.codeEditorFrame} ${className ?? ''}`}>
                    <Monaco
                        height="100%"
                        language="javascript"
                        path={selectedTask ? `solution-${selectedTask.id}.js` : 'solution.js'}
                        beforeMount={(monaco) => {
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
                        onMount={(editor) => {
                            editor.getAction('editor.action.formatDocument')?.run();
                        }}
                        value={value}
                        onChange={handleEditorChange}
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
            </div>
        </>
    );
}