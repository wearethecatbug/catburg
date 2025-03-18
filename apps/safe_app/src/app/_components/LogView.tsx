'use client'

import styles from './LogView.module.css';
import React, { useState, forwardRef, useRef} from 'react';

const LogView = forwardRef(function LogView({ logs,  }: { logs: string[]}, ref ) {
    const logRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState({ width: 250, height: 150 });
    const [isResizing, setIsResizing] = useState(false);
    const [position, setPosition] = useState({ x: 600, y: 710});


    const startDrag = (event: React.MouseEvent) => {
        event.preventDefault();
        const startX = event.clientX - position.x;
        const startY = event.clientY - position.y;

        const doDrag = (moveEvent: MouseEvent) => {
            if (!isResizing) {
                setPosition({
                    x: moveEvent.clientX - startX,
                    y: moveEvent.clientY - startY,
                });
            }
        };

        const stopDrag = () => {
            window.removeEventListener("mousemove", doDrag);
            window.removeEventListener("mouseup", stopDrag);
        };

        window.addEventListener("mousemove", doDrag);
        window.addEventListener("mouseup", stopDrag);
    };

    const startResize = (event: React.MouseEvent) => {
        event.preventDefault();
        setIsResizing(true);
        if (!logRef.current) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = logRef.current.offsetWidth;
        const startHeight = logRef.current.offsetHeight;

        const doResize = (moveEvent: MouseEvent) => {
            setSize({
                width: Math.max(200, startWidth + (moveEvent.clientX - startX)),
                height: Math.max(100, startHeight + (moveEvent.clientY - startY)),
            });
        };

        const stopResize = () => {
            setIsResizing(false);
            window.removeEventListener("mousemove", doResize);
            window.removeEventListener("mouseup", stopResize);
        };

        window.addEventListener("mousemove", doResize);
        window.addEventListener("mouseup", stopResize);
    };

    const renderLogs = () => {
        if (logs.length === 0) {
            return <p>No logs yet</p>;
        }
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
            <div
                className={styles.dragHandle}
                onMouseDown={startDrag}
            >
                Drag me
            </div>

            <div className={styles.textStyle}>
                {renderLogs()}
            </div>
            <div
                className={styles.resizeHandle}
                onMouseDown={startResize}
            />
        </div>
    );
});

export default LogView;