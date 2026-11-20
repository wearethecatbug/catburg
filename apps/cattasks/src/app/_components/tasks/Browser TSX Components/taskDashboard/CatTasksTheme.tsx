'use client';

import {createContext, useContext} from 'react';

export const catTasksThemes = ['light', 'dark', 'khorne', 'nurgle'] as const;

export type CatTasksTheme = (typeof catTasksThemes)[number];

export function getCatTasksTheme(value: string | null): CatTasksTheme {
    return catTasksThemes.find(theme => theme === value) ?? 'light';
}

export function isWarhammerTheme(theme: CatTasksTheme): theme is 'khorne' | 'nurgle' {
    return theme === 'khorne' || theme === 'nurgle';
}

export type CatTasksThemeContextValue = {
    readonly theme: CatTasksTheme;
    readonly setTheme: (theme: CatTasksTheme) => void;
};

export const CatTasksThemeContext = createContext<CatTasksThemeContextValue | null>(null);

export function useCatTasksTheme(): CatTasksThemeContextValue {
    const value = useContext(CatTasksThemeContext);
    if (!value) throw new Error('useCatTasksTheme must be used inside TaskDashboard.');
    return value;
}
