'use client';

import {createContext, useContext} from 'react';

export const catTasksThemes = ['light', 'dark', 'khorne', 'nurgle', 'slaanesh', 'tzeentch'] as const;

export type CatTasksTheme = (typeof catTasksThemes)[number];
export type WarhammerTheme = Exclude<CatTasksTheme, 'light' | 'dark'>;

export function getCatTasksTheme(value: string | null): CatTasksTheme {
    return catTasksThemes.find(theme => theme === value) ?? 'light';
}

export function isWarhammerTheme(theme: CatTasksTheme): theme is WarhammerTheme {
    return theme === 'khorne' || theme === 'nurgle' || theme === 'slaanesh' || theme === 'tzeentch';
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
