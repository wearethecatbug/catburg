"use client";
import React from "react";
import styles from "./MainBtnTest.module.css";
import {useTaskContext} from "../../context/TaskProvider";
import {runUserTests} from "../../lib/RunUserTests";
import {combineClassNames} from "@/app/_components/tasks/shared/utils/combineClassNames";


type HeaderBtnTestProps = {
    readonly className?: string;
    readonly isDisabled?: boolean;
}

export default function MainBtnTest({className, isDisabled}: HeaderBtnTestProps) {
    const {
        selectedTask,
        editorUserCode,
        setRunTest,
        setValidSolution,
        validSolution,
        runTest,
        setTestNotificationText,
    } = useTaskContext();

    const handleRunTestsClick = () => {
        const tests = Array.isArray(selectedTask?.tests) ? selectedTask.tests : [];

        const expectedFunctionName =
            selectedTask?.exportName ??
            selectedTask?.functionName ??
            selectedTask?.expectedExport ??
            selectedTask?.expectedFunctionName ??
            undefined;


        const {areAllTestsPassed, resultText} = runUserTests(
            editorUserCode ?? "",
            tests,
            expectedFunctionName,
            {suppressConsoleOutput: true},
        );

        setRunTest?.(true);
        setValidSolution?.(areAllTestsPassed);
        setTestNotificationText?.(resultText);
    };

    const getBtnClassName = combineClassNames(
        styles.btnTest,
        !selectedTask ? styles.disabled :
            !runTest ? styles.default :
                validSolution ? styles.success : styles.fail,
        className,
    );

    return (
        <button
            type="button"
            className={getBtnClassName}
            aria-label="Test Code"
            onClick={handleRunTestsClick}
            disabled={isDisabled}

        />
    );
}
