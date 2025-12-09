'use client';
import React from 'react';
import styles from './MainBtnShowDescription.module.css';
import {combineClassNames} from "@/app/_components/tasks/shared/utils/combineClassNames";

export type MainBtnShowDescriptionProps = {
    readonly className?: string;
    readonly isActive: boolean;      // true, когда показано описание
    readonly onClick: () => void;
    readonly ariaLabel?: string;
};

export default function MainBtnShowDescription({
                                                   className,
                                                   isActive,
                                                   onClick,
                                                   ariaLabel,
                                               }: MainBtnShowDescriptionProps) {

    const getBtnClassName = combineClassNames(
        styles.mainBtnTask,
        isActive ? styles.active : '',
        className ?? '',
    );

    return (
        <button
            type="button"
            className={getBtnClassName}
            onClick={onClick}
            aria-pressed={isActive}
            aria-label={ariaLabel ?? (isActive ? 'Показано описание' : 'Показать описание')}
        />
    );
}