'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import {useTaskContext} from "@/app/_components/tasks/context/TaskProvider";

const Monaco = dynamic(() => import('@monaco-editor/react'), {ssr: false});

export default function MainTaskSolutionEditor({
                                                   value,
                                                   onChange,
                                                   onMount,
                                               }: {
    readonly value: string;
    readonly onChange: (next: string) => void;
    readonly onMount?: (editor: any, monaco: any) => void;
}) {
    const {setEditorUserCodeAndReset} = useTaskContext();

    return (
        <Monaco
            value={value}
            onChange={(next) => onChange(next ?? '')}
            onMount={onMount}
            height="100%"
            width="100%"
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
            }}
        />
    );
}