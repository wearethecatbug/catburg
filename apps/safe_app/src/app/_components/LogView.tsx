'use client'

import styles from './LogView.module.css';
import {useState} from "react";

export default function LogView({logs}:{logs: string[]}) {

    return (
        <div className={[styles.logViewContainer].join('')}>
            <h3 className={styles.textStyle}>Logs</h3>
            <ul>
                {logs.map((log, index) => (
                    <li key={index} className={styles.textStyle}>{index + 1}: {log}</li>
                ))}
            </ul>
            {/*<button className={styles.textStyle} onClick={() => addLog(`Log entry ${logs.length + 1}`)}>Add Log</button>*/}
        </div>
    );
}