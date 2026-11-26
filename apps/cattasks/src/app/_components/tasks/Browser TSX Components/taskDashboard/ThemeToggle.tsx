'use client';

import {useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import {catTasksThemes, isWarhammerTheme, useCatTasksTheme, type CatTasksTheme} from './CatTasksTheme';
import styles from './ThemeToggle.module.css';
import Image from 'next/image';
import type {V146Construction} from '@/app/_components/tasks/Browser TSX Components/header/v146/V146Header';

type ThemeToggleProps = {
    readonly construction: V146Construction;
    readonly onConstructionChange: (construction: V146Construction) => void;
};

const themeIconSrc: Record<Exclude<CatTasksTheme, 'light' | 'dark'>, string> = {
    khorne: '/cattasks/themes/khorne/icon.svg',
    nurgle: '/cattasks/themes/nurgle/icon.svg',
    slaanesh: '/cattasks/themes/slaanesh/emblem.png',
};

export default function ThemeToggle({construction, onConstructionChange}: ThemeToggleProps) {
    const {theme, setTheme} = useCatTasksTheme();
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const firstOptionRef = useRef<HTMLButtonElement>(null);
    const isDark = theme === 'dark';
    const label = theme[0].toUpperCase() + theme.slice(1);

    useLayoutEffect(() => {
        if (isOpen) firstOptionRef.current?.focus();
    }, [isOpen]);

    const chooseTheme = (nextTheme: CatTasksTheme) => {
        setTheme(nextTheme);
        setIsOpen(false);
        triggerRef.current?.focus();
    };

    const openChooser = () => setIsOpen(open => !open);

    const closeChooser = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!isOpen || event.key !== 'Escape') return;
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
    };

    return (
        <div className={styles.themeChooser} data-theme={theme} onKeyDown={closeChooser}>
            <button
                ref={triggerRef}
                type="button"
                className={styles.themeToggle}
                aria-label={`Choose theme (current: ${label})`}
                aria-expanded={isOpen}
                aria-controls="cattasks-theme-options"
                onClick={openChooser}
            >
                {isWarhammerTheme(theme) ? (
                    <Image src={themeIconSrc[theme]} alt="" aria-hidden="true" width={28} height={28} unoptimized/>
                ) : (
                    <>
                        <span className={styles.skyMark} aria-hidden="true">{isDark ? '☾' : '☀'}</span>
                        <Image src="/cattasks/capybara-theme-toggle.webp" alt="" aria-hidden="true" width={34} height={34} unoptimized/>
                    </>
                )}
            </button>
            {isOpen && (
                <div id="cattasks-theme-options" className={styles.themeOptions} role="group" aria-label="Themes">
                    {catTasksThemes.map((option, index) => {
                        const optionLabel = option[0].toUpperCase() + option.slice(1);
                        const isSelected = option === theme;
                        return (
                            <button
                                ref={index === 0 ? firstOptionRef : undefined}
                                type="button"
                                className={styles.themeOption}
                                aria-pressed={isSelected}
                                key={option}
                                onClick={() => chooseTheme(option)}
                            >
                                {isWarhammerTheme(option) ? <Image src={option === 'slaanesh' ? '/cattasks/themes/slaanesh/icon.svg' : themeIconSrc[option]} alt="" aria-hidden="true" width={20} height={20} unoptimized/> : <span className={styles.optionMark} aria-hidden="true">{option === 'dark' ? '☾' : '☀'}</span>}
                                {optionLabel}
                            </button>
                        );
                    })}
                    {isWarhammerTheme(theme) && <div className={styles.constructionOptions} role="group" aria-label="Header construction">
                        {(['industrial', 'gothic', 'armor'] as const).map(option => <button type="button" className={styles.themeOption} aria-pressed={construction === option} key={option} onClick={() => onConstructionChange(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}
                    </div>}
                </div>
            )}
        </div>
    );
}
