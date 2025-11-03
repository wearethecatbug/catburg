import styles from './Main.module.css';
import MainTaskContentPanel from "./MainTaskContentPanel";
import MainCodeEditor from "./MainCodeEditor";

interface MainProps {
    readonly className?: string;
    // readonly children?: React.ReactNode;
}

export default function Main({className}: MainProps) {
    return (
        <div className={styles.mainContainer}>
            <MainTaskContentPanel className={styles.taskContentPanel}/>
            <MainCodeEditor className={styles.codeEditor}>

            </MainCodeEditor>

        </div>
    )
}