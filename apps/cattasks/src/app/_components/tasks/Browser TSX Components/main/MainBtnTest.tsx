"use client";
import React from "react";
import styles from "./MainBtnTest.module.css";
import {useTaskContext} from "../../context/TaskProvider";
import {combineClassNames} from "@/app/_components/tasks/shared/utils/combineClassNames";


type HeaderBtnTestProps = {
    readonly className?: string;
    readonly isDisabled?: boolean;
    readonly execute: (mode: "test") => Promise<void>;
}

export default function MainBtnTest({className, isDisabled, execute}: HeaderBtnTestProps) {
    const {
        selectedTask,
        selectedWorkspace,
    } = useTaskContext();

    const handleRunTestsClick = () => {
        void execute("test");
    };

    const getBtnClassName = combineClassNames(
        styles.btnTest,
        !selectedTask ? styles.disabled :
            selectedWorkspace?.result?.mode !== 'test' ? styles.default :
                selectedWorkspace.result.result.status === 'completed' ? styles.success : styles.fail,
        className,
    );

    return (
        <button
            type="button"
            className={getBtnClassName}
            aria-label="Test Code"
            onClick={handleRunTestsClick}
            disabled={isDisabled || !selectedTask}

        />
    );
}
