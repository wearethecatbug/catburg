import styles from './Main.module.css';
import MainTaskContentPanel from "./MainTaskContentPanel";
import MainCodeEditor from "./MainCodeEditor";

interface MainProps {
    readonly className?: string;
}

export default function Main({className}: MainProps) {
    return (
        <div className={`${styles.mainContainer} ${className ?? ''}`}>
            <MainTaskContentPanel className={styles.taskContentPanelContainer}/>
            <MainCodeEditor className={styles.codeEditor}>
            </MainCodeEditor>
        </div>
    )
}
