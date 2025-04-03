'use client';

import styles from "./SafeComponent.module.css";
import React, {useState, useEffect, useRef} from 'react'
import CatView from "@/app/_components/CatView";
import {initialCatViewState} from "@/app/_components/CatView"

interface SafeComponentProps {
    safeOpen: boolean;
    //isSafeComponentInitialized: boolean;
    //currentSkinCatViewState: keyof typeof initialCatViewState;
    updateCatViewState?: (newState: keyof typeof initialCatViewState) => void;
}

export default function SafeComponent({ safeOpen, updateCatViewState}: SafeComponentProps) {
    // const [currentSkinCatViewState, setCurrentSkinCatViewState] = useState<keyof typeof initialCatViewState | undefined>(undefined);

    // Флаг, который отслеживает, загружали ли мы состояние
    const hasLoaded = useRef(false);

    const loadCatViewState = async () => {
        return new Promise<keyof typeof initialCatViewState>((resolve) => {
            setTimeout(() => {
                resolve('defaultState'); // Эмуляция загрузки
            }, 100);
        });
    };

    useEffect(() => {
        if (!hasLoaded.current) {
            hasLoaded.current = true;
            loadCatViewState().then(updateCatViewState);
        }
    }, []);

    function getSafeComponent() {
        return safeOpen ?  <div className={styles.safeClose}></div>:<div className={styles.safeOpen}></div> ;
    }

    return (
        <div className={styles.safeContainer}>
                {/*<CatView*/}
                {/*    isSafeComponentInitialized={isSafeComponentInitialized}*/}
                {/*    currentSkinCatViewState={currentSkinCatViewState}*/}
                {/*    updateCatViewState={updateCatViewState}*/}
                {/*/>*/}
            {getSafeComponent()}
        </div>
    );
}