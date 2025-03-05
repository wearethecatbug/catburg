'use client'

import { useState } from "react";
import styles from "./ValidationInput.module.css"; // Импортируем CSS-модуль

const ValidationInput = () => {
    // Локальный стейт для хранения значения поля ввода
    const [value, setValue] = useState<string>("");

    // Стейт для отслеживания валидности введенного числа
    const [isValid, setIsValid] = useState<boolean | null>(null);

    // Функция определения CSS-класса для инпута
    const getInputClass = () => {
        if (isValid === true) return `${styles.inputField} ${styles.valid}`;  // Зеленый стиль при валидном значении
        if (isValid === false) return `${styles.inputField} ${styles.invalid}`; // Красный стиль при невалидном значении
        return styles.inputField; // Стандартный стиль (до валидации)
    };

    // Функция проверки введенного значения
    const validateInput = () => {
        const number = parseFloat(value); // Преобразуем введённый текст в число
        if (!isNaN(number) && number > 0 && number < 100) {
            setIsValid(true);  // Если число валидное, устанавливаем `isValid` в `true`
        } else {
            setIsValid(false); // Если невалидное, устанавливаем `isValid` в `false`
        }
    };


    /**
     * Вместо inline определения стиля инпута сделаем функцию getInputClass
     *
     * было так inline т.е стиль прямо в стрчке кода определялся
     *
     <input
         type="text"
         value={value}
         onChange={(e) => setValue(e.target.value)}
         className={`
            ${styles.inputField}  //Базовый стиль инпута
            ${isValid === true ? styles.valid : ""}   //Если isValid === true → зелёный стиль
            ${isValid === false ? styles.invalid : ""} // Если isValid === false → красный стиль
        `}
    />

     Стало так функцией
     const getInputClass = () => {
         if (isValid === true) return `${styles.inputField} ${styles.valid}`;
         if (isValid === false) return `${styles.inputField} ${styles.invalid}`;
         return styles.inputField;
     };

     className={getInputClass()}
     */

    return (
        <div className={styles.container}>
            {/* Поле ввода: изменение класса вынесено в отдельную функцию */}
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={getInputClass()}
            />
            {/* Кнопка проверки */}
            <button onClick={validateInput} className={styles.button}>
                ОК
            </button>
        </div>
    );
};

export default ValidationInput;
