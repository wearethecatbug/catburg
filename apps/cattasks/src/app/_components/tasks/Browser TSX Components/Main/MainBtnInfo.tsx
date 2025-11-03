"use client";
import React from "react";
import styles from "./MainBtnInfo.module.css";
import {useTaskContext} from "../../Context/TaskProvider";


type MainBtnInfoProps = {
    readonly className?: string;
    isActive: boolean;
    isDisabled: boolean;
    onClick: () => void;
    ariaLabel: string;
};

type TestResultDetail = {
    resultText: string;
    areAllTestsPassed: boolean;
};


export default function MainBtnInfo({
                                        className,
                                        isActive,
                                        isDisabled,
                                        onClick,
                                        ariaLabel,
                                    }: MainBtnInfoProps) {
    const {
        validSolution,
        runTest,
        testNotificationText,
        setTestNotificationText,
    } = useTaskContext();


    // useEffect(() => {
    //     const handleTestResult = (event: Event) => {
    //         const customEvent = event as CustomEvent<TestResultDetail>;
    //         const detail = customEvent.detail;
    //         if (!detail) return;
    //         setTestNotificationText(detail.resultText);
    //         // setIsTestInfoVisible(true);
    //     };
    //
    //     // безопасно в браузере
    //     if (typeof window !== "undefined") {
    //         window.addEventListener("capibara:testResult", handleTestResult as EventListener);
    //         return () => window.removeEventListener("capibara:testResult", handleTestResult as EventListener);
    //     }
    // }, []);


    const buttonClassName = [
        styles.mainBtnTestInfo,
        runTest ? (validSolution ? styles.success : styles.fail) : styles.default,
        className
    ].filter(Boolean).join(" ");


    return (
        <button
            type="button"
            className={buttonClassName}
            aria-label={ariaLabel}
            aria-pressed={isActive}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            onClick={onClick}
        />
    );
}


//
// export default function MainBtnInfo({className, children}: HeaderBtnInfoProps) {
//     const {runTest, validSolution} = useTaskContext();
//
//     const [isTestInfoVisible, setIsTestInfoVisible] = useState(false);
//     const [testNotificationText, setTestNotificationText] = useState<string>("");
//
//     useEffect(() => {
//         const handleTestResult = (event: Event) => {
//             const customEvent = event as CustomEvent<TestResultDetail>;
//             const detail = customEvent.detail;
//             if (!detail) return;
//             setTestNotificationText(detail.resultText);
//             setIsTestInfoVisible(true);
//         };
//
//         // безопасно в браузере
//         if (typeof window !== "undefined") {
//             window.addEventListener("capibara:testResult", handleTestResult as EventListener);
//             return () => window.removeEventListener("capibara:testResult", handleTestResult as EventListener);
//         }
//     }, []);

//     const getBtnTestInfoClassName = (hasRunTest: boolean, isValid?: boolean) => {
//         if (!hasRunTest) return styles.headerBtnTestInfo;
//         return `${styles.headerBtnTestInfo} ${isValid ? styles.headerBtnTestInfoSuccess : styles.headerBtnTestInfoError}`;
//     };
//
//     return (
//         <>
//             <button
//                 type="button"
//                 className={`${getBtnTestInfoClassName(runTest, validSolution)} ${className ?? ""}`}
//                 aria-label="Info"
//                 onClick={() => setIsTestInfoVisible(v => !v)}
//             />
//             <div
//                 className={`${styles.headerBtnTestErrorText} ${
//                     isTestInfoVisible && testNotificationText ? "" : styles.headerBtnTestErrorHidden
//                 }`}
//                 aria-hidden={!(isTestInfoVisible && !!testNotificationText)}
//             >
//                 {testNotificationText ?? ""}
//             </div>
//         </>
//     );
// }