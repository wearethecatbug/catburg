'use client';

import {useCatTasksTheme} from './CatTasksTheme';
import styles from './ThemeToggle.module.css';
import Image from 'next/image';

export default function ThemeToggle() {
    const {theme, toggleTheme} = useCatTasksTheme();
    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            className={styles.themeToggle}
            data-theme={theme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
        >
            <span className={styles.skyMark} aria-hidden="true">{isDark ? '☾' : '☀'}</span>
            <Image src="/cattasks/capybara-theme-toggle.webp" alt="" aria-hidden="true" width={34} height={34} unoptimized/>
        </button>
    );
}
