import type {Monaco} from '@monaco-editor/react';
import type {CatTasksTheme} from '../taskDashboard/CatTasksTheme';

const configuredMonacoInstances = new WeakSet<object>();

export const getMonacoThemeName = (theme: CatTasksTheme): string => theme === 'dark'
    ? 'catTasksDark'
    : theme === 'khorne' ? 'catTasksKhorne'
        : theme === 'nurgle' ? 'catTasksNurgle' : theme === 'slaanesh' ? 'catTasksSlaanesh' : 'catTasksLight';

export function defineCatTasksThemes(monaco: Monaco): void {
    if (configuredMonacoInstances.has(monaco)) return;
    configuredMonacoInstances.add(monaco);
    monaco.editor.defineTheme('catTasksLight', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#FDFEFC',
            'editor.foreground': '#294A3B',
            'editorLineNumber.foreground': '#5E6F62',
            'editorLineNumber.activeForeground': '#294A3B',
            'editor.selectionBackground': '#DCE9DACC',
            'editor.inactiveSelectionBackground': '#EDF0E588',
            'editorCursor.foreground': '#3F6B4C',
            'editorIndentGuide.background1': '#C5CEBC',
            'editorIndentGuide.activeBackground1': '#3F6B4C',
            'scrollbarSlider.background': '#C5CEBC88',
            'scrollbarSlider.hoverBackground': '#3F6B4C99',
            'scrollbarSlider.activeBackground': '#294A3B',
        },
    });
    monaco.editor.defineTheme('catTasksDark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#112A33',
            'editor.foreground': '#E3EEE8',
            'editorLineNumber.foreground': '#B1C7BF',
            'editorLineNumber.activeForeground': '#E3EEE8',
            'editor.selectionBackground': '#294852',
            'editor.inactiveSelectionBackground': '#29485288',
            'editorCursor.foreground': '#B3D4B5',
            'editorIndentGuide.background1': '#49676C',
            'editorIndentGuide.activeBackground1': '#B3D4B5',
            'scrollbarSlider.background': '#49676C88',
            'scrollbarSlider.hoverBackground': '#B3D4B599',
            'scrollbarSlider.activeBackground': '#E3EEE8',
        },
    });
    monaco.editor.defineTheme('catTasksKhorne', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#101517',
            'editor.foreground': '#EEE8D7',
            'editorLineNumber.foreground': '#8C8175',
            'editorLineNumber.activeForeground': '#EEE8D7',
            'editor.selectionBackground': '#4A221D',
            'editor.inactiveSelectionBackground': '#4A221D88',
            'editorCursor.foreground': '#D58B3A',
            'editorIndentGuide.background1': '#3A312B',
            'editorIndentGuide.activeBackground1': '#8C683A',
            'scrollbarSlider.background': '#8C683A88',
            'scrollbarSlider.hoverBackground': '#C6A66Acc',
            'scrollbarSlider.activeBackground': '#EEE8D7',
        },
    });
    monaco.editor.defineTheme('catTasksNurgle', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#101517',
            'editor.foreground': '#EEE8D7',
            'editorLineNumber.foreground': '#7F8A69',
            'editorLineNumber.activeForeground': '#EEE8D7',
            'editor.selectionBackground': '#34402A',
            'editor.inactiveSelectionBackground': '#34402A88',
            'editorCursor.foreground': '#B69854',
            'editorIndentGuide.background1': '#303A25',
            'editorIndentGuide.activeBackground1': '#9DB66A',
            'scrollbarSlider.background': '#5D654088',
            'scrollbarSlider.hoverBackground': '#9DB66Acc',
            'scrollbarSlider.activeBackground': '#EEE8D7',
        },
    });
    monaco.editor.defineTheme('catTasksSlaanesh', {
        base: 'vs-dark', inherit: true, rules: [],
        colors: {
            'editor.background': '#101517', 'editor.foreground': '#F7EAF7',
            'editorLineNumber.foreground': '#AC8AA9', 'editorLineNumber.activeForeground': '#F7EAF7',
            'editor.selectionBackground': '#6D356D', 'editor.inactiveSelectionBackground': '#6D356D88',
            'editorCursor.foreground': '#EDC9EF', 'editorIndentGuide.background1': '#4A3156',
            'editorIndentGuide.activeBackground1': '#DBA6DE', 'scrollbarSlider.background': '#8F579188',
            'scrollbarSlider.hoverBackground': '#DBA6DECC', 'scrollbarSlider.activeBackground': '#F7EAF7',
        },
    });
}
