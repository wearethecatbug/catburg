'use client';

import styles from "./SafeComponent.module.css";
import React, {useState} from 'react'
import CatView from "@/app/_components/CatView";

export default function SafeComponent() {
    const [safeOpenState, setSafeOpenState] = useState(true);

    function getSafeComponent() {
        if (safeOpenState) {
            return <div className={styles.safeOpen}></div>;
        } else {
            return <div className={styles.safeClose}></div>;
        }
    }

    return (
        <div className={styles.safeContainer} /*onClick={() => setSafeOpenState(!safeOpenState)}*/>
            <div className={styles.catViewContainer}>
                <CatView />
            </div>
            {getSafeComponent()}
        </div>
    );
}