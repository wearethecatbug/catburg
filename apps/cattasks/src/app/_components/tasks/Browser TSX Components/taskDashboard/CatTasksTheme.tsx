'use client';

import {createContext, useContext} from 'react';

export type CatTasksTheme = 'light' | 'dark';

export type CatTasksThemeContextValue = {
    readonly theme: CatTasksTheme;
    readonly toggleTheme: () => void;
};

export const CatTasksThemeContext = createContext<CatTasksThemeContextValue | null>(null);

export function useCatTasksTheme(): CatTasksThemeContextValue {
    const value = useContext(CatTasksThemeContext);
    if (!value) throw new Error('useCatTasksTheme must be used inside TaskDashboard.');
    return value;
}
