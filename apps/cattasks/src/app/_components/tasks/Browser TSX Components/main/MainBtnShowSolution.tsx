'use client';
import React from 'react';
import styles from './MainBtnShowSolution.module.css';

export type MainBtnShowSolutionProps = {
    readonly className?: string;
    readonly isActive: boolean;      // true, когда показано решение
    readonly isDisabled: boolean;    // true, когда задача не выбрана
    readonly onClick: () => void;
    readonly ariaLabel?: string;
};

export default function MainBtnShowSolution({
                                                className,
                                                isActive,
                                                isDisabled,
                                                onClick,
                                                ariaLabel,
                                            }: MainBtnShowSolutionProps) {
    const buttonClassName = [
        styles.btnSolution,
        isActive && styles.active,
        isDisabled && styles.disabled,
        className,
    ].filter(Boolean).join(' ');

    return (
        <button
            type="button"
            className={buttonClassName}
            onClick={onClick}
            disabled={isDisabled}
            aria-pressed={isActive}
            aria-label={ariaLabel ?? (isActive ? 'Показано решение' : 'Показать решение')}
        />
    );
}