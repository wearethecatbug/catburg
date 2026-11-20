'use client';

import {useRef, useState, type KeyboardEvent} from 'react';
import {catTasksThemes, useCatTasksTheme, type CatTasksTheme} from './CatTasksTheme';
import styles from './ThemeToggle.module.css';
import Image from 'next/image';

export default function ThemeToggle() {
    const {theme, setTheme} = useCatTasksTheme();
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const firstOptionRef = useRef<HTMLButtonElement>(null);
    const isDark = theme === 'dark';
    const label = theme[0].toUpperCase() + theme.slice(1);

    const chooseTheme = (nextTheme: CatTasksTheme) => {
        setTheme(nextTheme);
        setIsOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
    };

    const openChooser = () => {
        setIsOpen(open => {
            if (!open) requestAnimationFrame(() => firstOptionRef.current?.focus());
            return !open;
        });
    };

    const closeChooser = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setIsOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
    };

    return (
        <div className={styles.themeChooser} data-theme={theme}>
            <button
                ref={triggerRef}
                type="button"
                className={styles.themeToggle}
                aria-label={`Choose theme (current: ${label})`}
                aria-expanded={isOpen}
                aria-controls="cattasks-theme-options"
                onClick={openChooser}
            >
                {theme === 'khorne' ? (
                    <Image src="/cattasks/themes/khorne/icon.svg" alt="" aria-hidden="true" width={28} height={28} unoptimized/>
                ) : (
                    <>
                        <span className={styles.skyMark} aria-hidden="true">{isDark ? '☾' : '☀'}</span>
                        <Image src="/cattasks/capybara-theme-toggle.webp" alt="" aria-hidden="true" width={34} height={34} unoptimized/>
                    </>
                )}
            </button>
            {isOpen && (
                <div id="cattasks-theme-options" className={styles.themeOptions} role="group" aria-label="Themes" onKeyDown={closeChooser}>
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
                                {option === 'khorne' ? <Image src="/cattasks/themes/khorne/icon.svg" alt="" aria-hidden="true" width={20} height={20} unoptimized/> : <span className={styles.optionMark} aria-hidden="true">{option === 'dark' ? '☾' : '☀'}</span>}
                                {optionLabel}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
