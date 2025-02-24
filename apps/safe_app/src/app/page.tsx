import styles from "./Home.module.css";

import {Audiowide} from 'next/font/google'
import SafeContainer from "@/app/_components/SafeContainer";

const audiowide = Audiowide({
    weight: '400',
    subsets: ['latin'],
})

export default function Home() {
    return (
        <div className={styles.background}>
            <SafeContainer/>
        </div>
    );
}