import type {Monaco} from '@monaco-editor/react';
import type {CatTasksTheme} from '../taskDashboard/CatTasksTheme';

const configuredMonacoInstances = new WeakSet<object>();

export const getMonacoThemeName = (theme: CatTasksTheme): string => theme === 'dark'
    ? 'catTasksDark'
    : theme === 'khorne' ? 'catTasksKhorne'
        : theme === 'nurgle' ? 'catTasksNurgle' : 'vs-light';

export function defineCatTasksThemes(monaco: Monaco): void {
    if (configuredMonacoInstances.has(monaco)) return;
    configuredMonacoInstances.add(monaco);
    monaco.editor.defineTheme('catTasksDark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#10262F',
            'editor.foreground': '#E1EAE3',
            'editorLineNumber.foreground': '#78918E',
            'editorLineNumber.activeForeground': '#E1EAE3',
            'editor.selectionBackground': '#273F48',
            'editor.inactiveSelectionBackground': '#273F4888',
            'editorCursor.foreground': '#E7C88F',
            'editorIndentGuide.background1': '#273F48',
            'editorIndentGuide.activeBackground1': '#74947A',
            'scrollbarSlider.background': '#74947A88',
            'scrollbarSlider.hoverBackground': '#74947Acc',
            'scrollbarSlider.activeBackground': '#A9C1BE',
        },
    });
    monaco.editor.defineTheme('catTasksKhorne', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#171514',
            'editor.foreground': '#F4EAD2',
            'editorLineNumber.foreground': '#8C8175',
            'editorLineNumber.activeForeground': '#F4EAD2',
            'editor.selectionBackground': '#4A221D',
            'editor.inactiveSelectionBackground': '#4A221D88',
            'editorCursor.foreground': '#D58B3A',
            'editorIndentGuide.background1': '#3A312B',
            'editorIndentGuide.activeBackground1': '#8C683A',
            'scrollbarSlider.background': '#8C683A88',
            'scrollbarSlider.hoverBackground': '#C6A66Acc',
            'scrollbarSlider.activeBackground': '#F4EAD2',
        },
    });
    monaco.editor.defineTheme('catTasksNurgle', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#151A10',
            'editor.foreground': '#F3ECD2',
            'editorLineNumber.foreground': '#7F8A69',
            'editorLineNumber.activeForeground': '#F3ECD2',
            'editor.selectionBackground': '#34402A',
            'editor.inactiveSelectionBackground': '#34402A88',
            'editorCursor.foreground': '#B69854',
            'editorIndentGuide.background1': '#303A25',
            'editorIndentGuide.activeBackground1': '#9DB66A',
            'scrollbarSlider.background': '#5D654088',
            'scrollbarSlider.hoverBackground': '#9DB66Acc',
            'scrollbarSlider.activeBackground': '#F3ECD2',
        },
    });
}
