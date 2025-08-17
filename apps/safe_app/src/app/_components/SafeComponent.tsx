'use client';

import styles from "./SafeComponent.module.css";
import React, {useState, useEffect, useRef} from 'react'
import {initialCatViewState} from "@/components/CatView"

interface SafeComponentProps {
    safeOpen: boolean;
    updateCatViewState?: (newState: keyof typeof initialCatViewState) => void;
}

export default function SafeComponent({ safeOpen, updateCatViewState}: SafeComponentProps) {
    // Flag to track if we've loaded the state
    const hasLoaded = useRef(false);

    // Function to simulate loading state for safeComponent
    const loadCatViewState = async () => {
        return new Promise<keyof typeof initialCatViewState>((resolve) => {
            setTimeout(() => {
                resolve('defaultState'); // Simulate loading
            }, 100);
        });
    };

        useEffect(() => {
        if (!hasLoaded.current && updateCatViewState) {
            hasLoaded.current = true;
            loadCatViewState().then(updateCatViewState);
        }
    }, [updateCatViewState]);

    function getSafeComponent() {
        return safeOpen ?  <div className={styles.safeClose}></div>:<div className={styles.safeOpen}></div> ;
    }

    return (
        <div className={styles.safeContainer}>
            {getSafeComponent()}
        </div>
    );
}