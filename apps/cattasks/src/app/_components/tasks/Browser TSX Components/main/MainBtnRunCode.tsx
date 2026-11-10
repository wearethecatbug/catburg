"use client";
import React from "react";
import styles from "./MainBtnRunCode.module.css";
import {useTaskContext} from "../../context/TaskProvider";

interface MainBtnRunCodeProps {
    readonly className?: string;
    readonly execute: (mode: "run") => Promise<void>;
}

export default function MainBtnRunCode({className, execute}: MainBtnRunCodeProps) {
    const {selectedWorkspace} = useTaskContext();

    const handleClick = () => {
        void execute("run");
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
