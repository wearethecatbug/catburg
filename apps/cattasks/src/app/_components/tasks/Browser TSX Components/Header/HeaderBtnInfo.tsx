"use client";
import React, {useEffect, useState} from "react";
import styles from "./HeaderBtnInfo.module.css";
import {useTaskContext} from "../../Context/TaskProvider";


type HeaderBtnInfoProps = {
    readonly className?: string;
    readonly children?: React.ReactNode;
}

type TestResultDetail = {
    resultText: string;
    areAllTestsPassed: boolean;
};

export default function HeaderBtnInfo({className, children}: HeaderBtnInfoProps) {
    const {runTest, validSolution} = useTaskContext();

    const [isTestInfoVisible, setIsTestInfoVisible] = useState(false);
    const [testNotificationText, setTestNotificationText] = useState<string>("");

    useEffect(() => {
        const handleTestResult = (event: Event) => {
            const customEvent = event as CustomEvent<TestResultDetail>;
            const detail = customEvent.detail;
            if (!detail) return;
            setTestNotificationText(detail.resultText);
            setIsTestInfoVisible(true);
        };

        // безопасно в браузере
        if (typeof window !== "undefined") {
            window.addEventListener("capibara:testResult", handleTestResult as EventListener);
            return () => window.removeEventListener("capibara:testResult", handleTestResult as EventListener);
        }
    }, []);

    const getBtnTestInfoClassName = (hasRunTest: boolean, isValid?: boolean) => {
        if (!hasRunTest) return styles.headerBtnTestInfo;
        return `${styles.headerBtnTestInfo} ${isValid ? styles.headerBtnTestInfoSuccess : styles.headerBtnTestInfoError}`;
    };

    return (
        <>
            <button
                type="button"
                className={`${getBtnTestInfoClassName(runTest, validSolution)} ${className ?? ""}`}
                aria-label="Info"
                onClick={() => setIsTestInfoVisible(v => !v)}
            />
            <div
                className={`${styles.headerBtnTestErrorText} ${
                    isTestInfoVisible && testNotificationText ? "" : styles.headerBtnTestErrorHidden
                }`}
                aria-hidden={!(isTestInfoVisible && !!testNotificationText)}
            >
                {testNotificationText ?? ""}
            </div>
        </>
    );
}