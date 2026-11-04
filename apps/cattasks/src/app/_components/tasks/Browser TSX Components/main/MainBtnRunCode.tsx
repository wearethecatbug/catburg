"use client";
import React from "react";
import styles from "./MainBtnRunCode.module.css";
import {useTaskContext} from "../../context/TaskProvider";
import type {IsolatedTaskRequest} from "../../lib/IsolatedTaskRunner";

interface MainBtnRunCodeProps {
    readonly className?: string;
    readonly execute: (request: IsolatedTaskRequest) => Promise<void>;
}

export default function MainBtnRunCode({className, execute}: MainBtnRunCodeProps) {
    const {selectedWorkspace} = useTaskContext();

    const handleClick = async () => {
        await execute({requestId: crypto.randomUUID(), mode: "run", code: selectedWorkspace?.draft ?? ""});
    };

    return (
        <button
            type="button"
            className={`${styles.mainBtnRunCode} ${className ?? ""}`}
            aria-label="Run Code"
            onClick={handleClick}
            disabled={!selectedWorkspace}
        />
    );
}
