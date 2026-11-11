"use client";
import React from "react";
import styles from "./MainBtnInfo.module.css";
import {combineClassNames} from "@/app/_components/tasks/shared/utils/combineClassNames";


type MainBtnInfoProps = {
    readonly className?: string;
    isActive: boolean;
    isDisabled: boolean;
    onClick: () => void;
    ariaLabel: string;
};

export default function MainBtnInfo({
                                        className,
                                        isActive,
                                        isDisabled,
                                        onClick,
                                        ariaLabel,
                                    }: MainBtnInfoProps) {
    const getBtnClassName = combineClassNames(
        styles.btnTestInfo,
        isActive ? styles.active : '',
        isDisabled ? styles.disabled : styles.default,
        className,
    );


    return (
        <button
            type="button"
            className={getBtnClassName}
            aria-label={`Hint: ${ariaLabel}`}
            aria-pressed={isActive}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            onClick={onClick}
        >
            <span>Hint</span>
        </button>
    );
}

