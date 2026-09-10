import {useState} from "react";
import styles from "./safe-settings-prototype.module.css";

type InputCodeRangeNumbers = {
    firstNumberCodeRange: number,
    setFirstNumberCodeRange: (value: number) => void
    secondNumberCodeRange: number,
    setSecondNumberCodeRange: (value: number) => void
}

type InputHintRangeNumbers = {
    firstNumberHintRange: number,
    setFirstNumberHintRange: (value: number) => void
    secondNumberHintRange: number,
    setSecondNumberHintRange: (value: number) => void
}

export default function SafeSettings({inputCodeRangeNumbers, inputHintRangeNumbers}: {
    inputCodeRangeNumbers?: InputCodeRangeNumbers, // Сделал их опциональными (?)
    inputHintRangeNumbers?: InputHintRangeNumbers
}) {

    const [isExpanded, setIsExpanded] = useState(false);

    //  Функция для переключения состояния
    const toggleInputs = () => {
        setIsExpanded((prev) => !prev);
    };

    const classNames = {
        safeSettingsInputContainer: `${styles.safeSettingsInputContainer} ${isExpanded ? styles.show : styles.hidden}`,
        inputsContainer: `${styles.inputsContainer} ${isExpanded ? styles.show : ""}`,
    };
    const handleChange = (setter: (value: number) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setter(Number(event.target.value));
    };

    return (
        <div className={styles.settingContainer}>
            <button className={styles.safeSettingsButton} onClick={toggleInputs}/>
            {isExpanded && (
                <div className={styles.safeSettingsInputContainer}>
                    <div className={classNames.inputsContainer}>
                        {inputCodeRangeNumbers && ( // Проверяем, передан ли объект
                            <div className={styles.inputWrapper}>
                                <label className={styles.label}>Range Code Number</label>
                                <input
                                    type="number"
                                    value={inputCodeRangeNumbers.firstNumberCodeRange}
                                    onChange={handleChange(inputCodeRangeNumbers.setFirstNumberCodeRange)}
                                    className={styles.input}
                                />
                                <input
                                    type="number"
                                    value={inputCodeRangeNumbers.secondNumberCodeRange}
                                    onChange={handleChange(inputCodeRangeNumbers.setSecondNumberCodeRange)}
                                    className={styles.input}
                                />
                            </div>
                        )}

                        {inputHintRangeNumbers && ( // Проверяем, передан ли объект
                            <div className={styles.inputWrapper}>
                                <label className={styles.label}>Range Hint Number</label>
                                <input
                                    type="number"
                                    value={inputHintRangeNumbers.firstNumberHintRange}
                                    onChange={handleChange(inputHintRangeNumbers.setFirstNumberHintRange)}
                                    className={styles.input}
                                />
                                <input
                                    type="number"
                                    value={inputHintRangeNumbers.secondNumberHintRange}
                                    onChange={handleChange(inputHintRangeNumbers.setSecondNumberHintRange)}
                                    className={styles.input}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}