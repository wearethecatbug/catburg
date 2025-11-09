"use client";
import React from "react";
import styles from "./MainBtnInfo.module.css";
import {useTaskContext} from "../../context/TaskProvider";

type MainBtnInfoProps = {
    readonly className?: string;
    isActive: boolean;
    isDisabled: boolean;
    onClick: () => void;
    ariaLabel: string;
};

type TestResultDetail = {
    resultText: string;
    areAllTestsPassed: boolean;
};


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

    const buttonClassName = [
        styles.mainBtnTestInfo,
        runTest ? (validSolution ? styles.success : styles.fail) : styles.default,
        className
    ].filter(Boolean).join(" ");


    return (
        <button
            type="button"
            className={buttonClassName}
            aria-label={ariaLabel}
            aria-pressed={isActive}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            onClick={onClick}
        />
    );
}

