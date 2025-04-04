'use client'

import styles from './LogView.module.css';
import React, {useState, forwardRef, useRef} from 'react';

const LogView = forwardRef(function LogView({logs,}: { logs: string[] }, ref) {
    const logRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState({width: 250, height: 150});
    const [isResizing, setIsResizing] = useState(false);
    const [position, setPosition] = useState({x: 740, y: 770});


    const startDrag = (event: React.MouseEvent) => {
        event.preventDefault();
        // Запоминаем смещение курсора от верхнего левого угла компонента
        const startX = event.clientX - position.x;
        const startY = event.clientY - position.y;

        // Обработчик перемещения мыши
        const doDrag = (moveEvent: MouseEvent) => {
            if (!isResizing) {
                setPosition({
                    x: moveEvent.clientX - startX,
                    y: moveEvent.clientY - startY,
                });
            }
        };
        // Удаляем слушатели после окончания перемещения
        const stopDrag = () => {
            window.removeEventListener("mousemove", doDrag);
            window.removeEventListener("mouseup", stopDrag);
        };

        // Назначаем слушатели
        window.addEventListener("mousemove", doDrag);
        window.addEventListener("mouseup", stopDrag);
    };

    // Устанавливаем начальные размеры и положение для ресайза
    const startResize = (event: React.MouseEvent) => {
        event.preventDefault();
        setIsResizing(true);
        if (!logRef.current) return;
        // Начальные координаты мыши и размеры контейнера
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = logRef.current.offsetWidth;
        const startHeight = logRef.current.offsetHeight;
        // Обработчик изменения размеров
        const doResize = (moveEvent: MouseEvent) => {
            setSize({
                width: Math.max(200, startWidth + (moveEvent.clientX - startX)),
                height: Math.max(100, startHeight + (moveEvent.clientY - startY)),
            });
        };
        // Удаляем слушатели, когда ресайз завершён
        const stopResize = () => {
            setIsResizing(false);
            window.removeEventListener("mousemove", doResize);
            window.removeEventListener("mouseup", stopResize);
        };
        // Назначаем слушатели
        window.addEventListener("mousemove", doResize);
        window.addEventListener("mouseup", stopResize);
    };

    // Функция для отображения логов
    const renderLogs = () => {
        if (logs.length === 0) {
            return <p>No logs yet</p>;
        }
        // Удаляем дубликаты логов и отображаем их
        return <p>{Array.from(new Set(logs)).join(" , ")}</p>;
    };

    return (
        <div
            ref={logRef || ref}
            className={styles.logViewContainer}
            style={{
                left: `${position.x}px`, // 📌 Фиксированная позиция
                top: `${position.y}px`,
                width: size.width,
                height: size.height,
            }}
        >
            {/* Верхняя панель для перетаскивания */}
            <div
                className={styles.dragHandle}
                onMouseDown={startDrag}
            >
                Drag me
            </div>
            {/* Тело логов */}
            <div className={styles.textStyle}>
                {renderLogs()}
            </div>
            {/* Нижний уголок для изменения размера */}
            <div
                className={styles.resizeHandle}
                onMouseDown={startResize}
            />
        </div>
    );
});

export default LogView;