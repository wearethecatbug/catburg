import styles from "@/components/CatView.module.css";
import React, {useEffect} from "react";

interface CatViewState {
    defaultState: string;
    giveUpHint: string;
    safeContainerNoAction: string;
    hintPopupContainerGiveUp: string;
    hintPopupViewOpen: string;
    userWin: string;
    petpet: string;
    giveUpGame: string;
    winHint: string;
}

export const initialCatViewState: Readonly<CatViewState> = {
    defaultState: 'pet',
    giveUpHint: 'fail',
    safeContainerNoAction: 'sleepy',
    hintPopupContainerGiveUp: 'confused',
    hintPopupViewOpen: 'thinking',
    userWin:  'shocked',
    petpet: 'thanks',
    giveUpGame: 'fail',
    winHint: 'clap',
} as const;

interface CatViewProps {
    isSafeComponentInitialized: boolean;
    currentSkinCatViewState: keyof Readonly<CatViewState> | undefined; // Возможно, undefined
    updateCatViewState: (newState: keyof Readonly<CatViewState>) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export default function CatView({ isSafeComponentInitialized,currentSkinCatViewState,updateCatViewState, onMouseEnter,
                                    onMouseLeave }: CatViewProps) {
    console.log("currentSkinCatViewState передается в CatView:", currentSkinCatViewState);
    useEffect(() => {
        if (!currentSkinCatViewState) {
            console.warn("Некорректное состояние для currentSkinCatViewState, устанавливаем defaultState");
            updateCatViewState("defaultState");
        }
    }, [currentSkinCatViewState, updateCatViewState]);

    // const validState = currentSkinCatViewState || 'defaultState';
    if (!isSafeComponentInitialized || !currentSkinCatViewState) {
        return <div className={styles.catContainerPlaceholder}></div>;
    }
    console.log(currentSkinCatViewState)
    console.log(isSafeComponentInitialized)

    function getCatSkin(currentSkinCatViewState: keyof CatViewState) {
        return {"--bgSrc": `url(/${initialCatViewState[currentSkinCatViewState]}.png)`} as React.CSSProperties;
    }

    return (
        <div className={styles.catContainer} style={getCatSkin(currentSkinCatViewState)} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}></div>
    );

}
