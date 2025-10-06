'use client';

import React, {createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState} from 'react';


export type Mode = 'system' | 'light' | 'dark' | 'blue';
type Resolved = 'light' | 'dark' | 'blue';

type Ctx = {
    mode: Mode;
    resolved: Resolved;
    setMode: (m: Mode) => void;
    toggle: () => void; // light <-> dark
    cycle: () => void;  // system/light/dark/blue
};

const KEY = 'theme:v1';
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({children}: { children: React.ReactNode }) {
    const [mode, setMode] = useState<Mode>(() => {
        try {
            return (localStorage.getItem(KEY) as Mode) ?? 'system';
        } catch {
            return 'system';
        }
    });

    const prefersDark = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
        []
    );

    const resolved: Resolved = useMemo(() => {
        if (mode === 'system') return prefersDark ? 'dark' : 'light';
        return mode;
    }, [mode, prefersDark]);

    useLayoutEffect(() => {
        document.documentElement.setAttribute('data-theme', resolved);
    }, [resolved]);

    useEffect(() => {
        try {
            localStorage.setItem(KEY, mode);
        } catch {
        }
    }, [mode]);

    useEffect(() => {
        const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!mq) return;
        const onChange = () => {
            if (mode === 'system') {
                document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
            }
        };
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, [mode]);

    useEffect(() => {
        const on = (e: StorageEvent) => {
            if (e.key === KEY) setMode((e.newValue as Mode) ?? 'system');
        };
        window.addEventListener('storage', on);
        return () => window.removeEventListener('storage', on);
    }, []);

    const toggle = useCallback(() => {
        setMode(m => (m === 'dark' ? 'light' : 'dark'));
    }, []);
    const cycle = useCallback(() => {
        setMode(m => {
            if (m === 'system') return prefersDark ? 'light' : 'dark';
            if (m === 'light') return 'dark';
            if (m === 'dark') return 'blue';
            return 'light';
        });
    }, [prefersDark]);

    const value = useMemo<Ctx>(() => ({mode, resolved, setMode, toggle, cycle}), [mode, resolved, toggle, cycle]);

    return (
        <div>
            <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
        </div>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeCtx);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}