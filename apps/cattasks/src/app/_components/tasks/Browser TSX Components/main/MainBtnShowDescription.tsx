'use client';
import React from 'react';
import styles from './MainBtnShowDescription.module.css';

export type MainBtnShowDescriptionProps = {
    readonly className?: string;
    readonly isActive: boolean;      // true, когда показано описание
    readonly isDisabled: boolean;    // true, когда задача не выбрана
    readonly onClick: () => void;
    readonly ariaLabel?: string;
};

export default function MainBtnShowDescription({
                                                   className,
                                                   isActive,
                                                   isDisabled,
                                                   onClick,
                                                   ariaLabel,
                                               }: MainBtnShowDescriptionProps) {
    const buttonClassName = [
        styles.mainBtnTask,
        isActive ? styles.active : '',
        className ?? '',
    ].join(' ').trim();

    return (
        <button
            type="button"
            className={buttonClassName}
            onClick={onClick}
            disabled={isDisabled}
            aria-pressed={isActive}
            aria-label={ariaLabel ?? (isActive ? 'Показано описание' : 'Показать описание')}
        />
    );
}