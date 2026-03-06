import styles from './Main.module.css';
import MainTaskContentPanel from "./MainTaskContentPanel";
import MainCodeEditor from "./MainCodeEditor";

// interface MainProps {
//     readonly className?: string;
// }

export default function Main() {
    return (
        <div className={styles.mainContainer}>
            <MainTaskContentPanel className={styles.taskContentPanelContainer}/>
            <MainCodeEditor className={styles.codeEditor}>
            </MainCodeEditor>
        </div>
    )
}