import styles from "./Home.module.css";
import SafeComponent from "@/app/_components/SafeComponent";

import { Audiowide } from 'next/font/google'
import SafeMenu from "@/app/_components/SafeMenu";

const audiowide = Audiowide({
    weight: '400',
    subsets: ['latin'],
})

export default function Home() {
    return (
        <div className={styles.background}>
            <div className={styles.safeContainer}>
                <p className={styles.headerText}>The safe code is a number that ranges from 1 to 1000</p>
               <div className={styles.safeAndMenuContainer}>
                   <SafeComponent/>
                   <SafeMenu/>
               </div>
            </div>
            <div>

            </div>

        </div>
    );
}