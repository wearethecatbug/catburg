import styles from './Main.module.css';
import MainTaskDetails from "./MainTaskDetails";
import MainCodeEditor from "./MainCodeEditor";

interface MainProps {
    readonly className?: string;
    // readonly children?: React.ReactNode;
}

export default function Main({className}: MainProps) {
    return (
        <div className={styles.mainContainer}>
            <MainTaskDetails className={styles.taskDetails}/>
            <MainCodeEditor className={styles.codeEditor}/>
        </div>
    )
}