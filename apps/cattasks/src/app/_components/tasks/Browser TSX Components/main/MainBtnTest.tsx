"use client";
import React, {useRef} from "react";
import styles from "./TextureActionButton.module.css";
import {useTaskContext} from "../../context/TaskProvider";
import type {IsolatedTaskRequest} from "../../lib/IsolatedTaskRunner";


type HeaderBtnTestProps = {
    readonly isDisabled?: boolean;
    readonly isPending?: boolean;
    readonly material: "linen" | "wood";
    readonly execute: (request: IsolatedTaskRequest) => Promise<void>;
}

export default function MainBtnTest({isDisabled, isPending = false, material, execute}: HeaderBtnTestProps) {
    const {
        selectedTask,
        selectedWorkspace,
    } = useTaskContext();
    const selectedTaskIdRef = useRef(selectedTask?.id);
    selectedTaskIdRef.current = selectedTask?.id;

    const handleRunTestsClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
        const button = event.currentTarget;
        const taskId = selectedTask?.id;
        const restoreFocus = document.activeElement === button;
        await execute({
            requestId: crypto.randomUUID(),
            mode: "test",
            code: selectedWorkspace?.draft ?? "",
            entryPoint: selectedTask?.entryPoint,
            tests: selectedTask?.tests,
        });
        if (!restoreFocus) return;

        requestAnimationFrame(() => {
            if (selectedTaskIdRef.current !== taskId || !button.isConnected || button.disabled || document.activeElement !== document.body) return;
            button.focus();
        });
    };

    const resultState = selectedWorkspace?.result?.mode !== "test"
        ? undefined
        : selectedWorkspace.result.result.status === "completed" ? "success" : "failure";

    return (
        <button
            type="button"
            className={styles.button}
            aria-label="Test Code"
            onClick={handleRunTestsClick}
            disabled={isDisabled || !selectedTask || isPending}
            aria-busy={isPending || undefined}
            data-variant="test"
            data-material={material}
            data-result={resultState}
            data-pending={isPending || undefined}
        >
            {/*
             * Lucide Icons ISC License
             * Copyright (c) 2026 Lucide Icons and Contributors
             * Permission to use, copy, modify, and/or distribute this software for any
             * purpose with or without fee is hereby granted, provided that the above
             * copyright notice and this permission notice appear in all copies.
             * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
             * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
             * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
             * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
             * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
             * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
             * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
             */}
            <span className={styles.icon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
                    <path d="M6.453 15h11.094" />
                    <path d="M8.5 2h7" />
                </svg>
            </span>
            <span className={styles.label}>Test</span>
        </button>
    );
}
