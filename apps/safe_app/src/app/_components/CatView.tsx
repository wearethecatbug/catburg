import styles from "@/app/_components/CatView.module.css";
import React, {useEffect, useState} from "react";

const catState = ['clap', 'fail', 'long', 'pet', 'shocked', 'sleepy', 'thanks', 'thinking']

export default function CatView() {

    const [currentSkinState, setCurrentSkinState] = useState(0);

    function getCatSkin() {
        return {"--bgSrc": `url(/${catState[currentSkinState]}.png)`} as React.CSSProperties;
    }

    useEffect(() => {
        const interval = setInterval(() => {
            changeSkin();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    function changeSkin() {
        setCurrentSkinState((value) => {
            if (value + 1 >= catState.length) {
                return 0;
            } else {
                return value + 1;
            }
        });
    }

    return <div style={getCatSkin()} onClick={() => changeSkin()} className={styles.cat}></div>;
}
