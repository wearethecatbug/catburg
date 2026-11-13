"use client";
import React, {useRef} from "react";
import styles from "./TextureActionButton.module.css";
import {useTaskContext} from "../../context/TaskProvider";
import type {IsolatedTaskRequest} from "../../lib/IsolatedTaskRunner";

interface MainBtnRunCodeProps {
    readonly isPending?: boolean;
    readonly material: "linen" | "wood";
    readonly execute: (request: IsolatedTaskRequest) => Promise<void>;
}

export default function MainBtnRunCode({isPending = false, material, execute}: MainBtnRunCodeProps) {
    const {selectedTask, selectedWorkspace} = useTaskContext();
    const selectedTaskIdRef = useRef(selectedTask?.id);
    selectedTaskIdRef.current = selectedTask?.id;

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
        const button = event.currentTarget;
        const taskId = selectedTask?.id;
        const restoreFocus = document.activeElement === button;
        await execute({requestId: crypto.randomUUID(), mode: "run", code: selectedWorkspace?.draft ?? ""});
        if (!restoreFocus) return;

        requestAnimationFrame(() => {
            if (selectedTaskIdRef.current !== taskId || !button.isConnected || button.disabled || document.activeElement !== document.body) return;
            button.focus();
        });
    };

    return (
        <button
            type="button"
            className={styles.button}
            aria-label="Run Code"
            onClick={handleClick}
            disabled={!selectedWorkspace || isPending}
            aria-busy={isPending || undefined}
            data-variant="run"
            data-material={material}
            data-pending={isPending || undefined}
        >
            <span className={styles.icon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.5v13l10-6.5z" />
                </svg>
            </span>
            <span className={styles.label}>Run</span>
        </button>
    );
}
