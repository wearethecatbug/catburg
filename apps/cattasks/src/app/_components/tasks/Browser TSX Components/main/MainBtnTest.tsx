"use client";
import React from "react";
import styles from "./MainBtnTest.module.css";
import {useTaskContext} from "../../context/TaskProvider";
import {runUserTests} from "../../lib/RunUserTests";

//
// type HeaderBtnTestProps = {
//     readonly className?: ;
// }

export default function MainBtnTest({className}: { readonly className?: string }) {
    const {
        selectedTask,
        editorUserCode,
        setRunTest,
        setValidSolution,
        validSolution,
        runTest
    } = useTaskContext();

    // useEffect(() => {
    //     setRunTest?.(false);
    // }, [editorUserCode, setRunTest]);

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

    const getBtnClassName = [
        styles.btnTest,
        !runTest ? styles.default :
            validSolution ? styles.success : styles.fail,
        className,
    ].filter(Boolean).join(' ');
    console.log('runTest=', runTest, 'validSolution=', validSolution);
    return (
        <button
            type="button"
            className={getBtnClassName}
            aria-label="Test Code"
            onClick={handleRunTestsClick}
        />
    );
}