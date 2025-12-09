"use client";
import React from "react";
import styles from "./MainBtnInfo.module.css";
import {useTaskContext} from "../../context/TaskProvider";
import {combineClassNames} from "@/app/_components/tasks/shared/utils/combineClassNames";


type MainBtnInfoProps = {
    readonly className?: string;
    isActive: boolean;
    isDisabled: boolean;
    onClick: () => void;
    ariaLabel: string;
};

// type TestResultDetail = {
//     resultText: string;
//     areAllTestsPassed: boolean;
// };

export default function MainBtnInfo({
                                        className,
                                        isActive,
                                        isDisabled,
                                        onClick,
                                        ariaLabel,
                                    }: MainBtnInfoProps) {
    const {
        validSolution,
        runTest,
    } = useTaskContext();

    const getBtnClassName = combineClassNames(
        styles.btnTestInfo,
        runTest ? (validSolution ? styles.success : styles.fail) :
            isDisabled ? styles.disabled : styles.default,
        className,
    );


    return (
        <button
            type="button"
            className={getBtnClassName}
            aria-label={ariaLabel}
            aria-pressed={isActive}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            onClick={onClick}
        />
    );
}

