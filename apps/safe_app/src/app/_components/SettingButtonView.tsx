import { useState } from "react";
import styles from "./SettingButtonView.module.css";

export default function SafeSettings() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [firstNumberCodeRange,  setFirstNumberCodeRange] = useState("");
    const [secondNumberCodeRange, setSecondNumberCodeRange] = useState("");
    const [firstNumberHintRange,  setFirstNumberHintRange] = useState("");
    const [secondNumberHintRange, setSecondNumberHintRange] = useState("");

    const toggleInputs = () => {
        setIsExpanded((prev) => !prev);
    };

    const classNames = {
        safeSettingsInputContainer: `${styles.safeSettingsInputContainer} ${isExpanded ? styles.show : styles.hidden}`,
        inputsContainer: `${styles.inputsContainer} ${isExpanded ? styles.show : ""}`,
    };


    return (
        <>
        <button className={styles.safeSettingsButton} onClick={toggleInputs}></button>

            {isExpanded && (
                <div className={styles.safeSettingsInputContainer}>
                <div className={classNames.inputsContainer}>
                    <div className={styles.inputWrapper}>
                        <label className={styles.label}>Range Code Number</label>
                        <input
                        type="number"
                        value={firstNumberCodeRange}
                        onChange={(e) => setFirstNumberCodeRange(e.target.value)}
                        className={styles.input}
                    />
                    <input
                        type="number"
                        value={secondNumberCodeRange}
                        onChange={(e) => setSecondNumberCodeRange(e.target.value)}
                        className={styles.input}
                    />

                </div>
                <div className={styles.inputWrapper}>
                    <label className={styles.label}>Range Hint Number</label>
                    <input
                        type="number"
                        value={firstNumberHintRange}
                        onChange={(e) => setFirstNumberHintRange(e.target.value)}
                        className={styles.input}
                    />
                    <input
                        type="number"
                        value={secondNumberHintRange}
                        onChange={(e) => setSecondNumberHintRange(e.target.value)}
                        className={styles.input}
                    />
                </div>
                </div>
                </div>
            )}
        </>
    );
}