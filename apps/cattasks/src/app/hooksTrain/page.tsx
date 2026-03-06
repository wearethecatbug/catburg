import styles from "./page.module.css";
import {Todos} from "./hooks";

export default function Page() {
    return (
        <main className={styles.main}>
            <Todos/>
        </main>
    );
}