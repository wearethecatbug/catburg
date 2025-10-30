"use client";
import React, {useEffect} from "react";
import styles from "./HeaderBtnTest.module.css";
import {useTaskContext} from "../../Context/TaskProvider";
import {runUserTests} from "../../lib/RunUserTests";

export default function HeaderBtnTest({className}: { readonly className?: string }) {
    const {
        selectedTask,
        editorUserCode,
        setRunTest,
        setValidSolution,
    } = useTaskContext();

    useEffect(() => {
        setRunTest?.(false);
    }, [editorUserCode, setRunTest]);

    const handleRunTestsClick = () => {
        const tests = Array.isArray(selectedTask?.tests) ? selectedTask.tests : [];

        const expectedFunctionName =
            (selectedTask as any)?.exportName ??
            (selectedTask as any)?.functionName ??
            (selectedTask as any)?.expectedExport ??
            (selectedTask as any)?.expectedFunctionName ??
            undefined;

        const {areAllTestsPassed, resultText} = runUserTests(
            editorUserCode ?? "",
            tests,
            expectedFunctionName,
            {suppressConsoleOutput: true},
        );

        setRunTest?.(true);
        setValidSolution?.(areAllTestsPassed);

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("capibara:testResult", {
                detail: {resultText, areAllTestsPassed}
            }));
        }
    };

    return (
        <button
            type="button"
            className={`${styles.headerBtnTest} ${className ?? ""}`}
            aria-label="Test Code"
            onClick={handleRunTestsClick}
        />
    );
}