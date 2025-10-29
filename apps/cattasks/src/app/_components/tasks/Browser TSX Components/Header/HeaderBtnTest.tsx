"use client";
import React, {useEffect, useState} from "react";
import styles from "./HeaderBtnTest.module.css";
import {useTaskContext} from "../../Context/TaskProvider";
import {runUserTests} from "../../lib/RunUserTests";

export default function HeaderBtnTest({className}: { readonly className?: string }) {
    const {
        selectedTask,
        editorUserCode,
        setRunTest,
        setValidSolution,
        validSolution,
        runTest,
    } = useTaskContext();

    const [isTestInfoVisible, setIsTestInfoVisible] = useState(false);
    const [testNotificationText, setTestNotificationText] = useState<string>("");

    useEffect(() => {
        setRunTest?.(false);
        setIsTestInfoVisible(false);
        setTestNotificationText("");
    }, [editorUserCode, setRunTest]);

    const handleRunTestsClick = () => {
        const tests = Array.isArray(selectedTask?.tests)
            ? selectedTask.tests
            : [];

        const expectedFunctionName =
            (selectedTask as any)?.exportName ??
            (selectedTask as any)?.functionName ??
            (selectedTask as any)?.expectedExport ??
            (selectedTask as any)?.expectedFunctionName ??
            undefined;

        const {
            areAllTestsPassed,
            resultText,
        } = runUserTests(editorUserCode ?? "", tests, expectedFunctionName, {
            suppressConsoleOutput: true,
        });

        setRunTest?.(true);
        setValidSolution?.(areAllTestsPassed);
        setTestNotificationText(resultText);
        setIsTestInfoVisible(true);
    };

    const getBtnTestInfoClassName = (hasRunTest: boolean, isValid?: boolean) => {
        if (!hasRunTest) return styles.headerBtnTestInfo;
        return `${styles.headerBtnTestInfo} ${isValid ? styles.headerBtnTestInfoSuccess : styles.headerBtnTestInfoError}`;
    };

    return (
        <>
            <button
                type="button"
                className={styles.headerBtnTest}
                aria-label="Test Code"
                onClick={handleRunTestsClick}
            />
            <button
                type="button"
                className={getBtnTestInfoClassName(runTest, validSolution)}
                aria-label="Info"
                onClick={() => setIsTestInfoVisible(v => !v)}
            />
            <div
                className={`${styles.headerBtnTestErrorText} ${isTestInfoVisible && testNotificationText ? "" : styles.headerBtnTestErrorHidden}`}
                aria-hidden={!(isTestInfoVisible && !!testNotificationText)}
            >
                {testNotificationText ?? ""}
            </div>
        </>
    );
}




