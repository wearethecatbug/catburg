import styles from './Main.module.css';
import MainTaskContentPanel from "./MainTaskContentPanel";
import MainCodeEditor from "./MainCodeEditor";
import {useCatTasksTheme} from '../taskDashboard/CatTasksTheme';

interface MainProps {
    readonly className?: string;
}

export default function Main({className}: MainProps) {
    const {theme} = useCatTasksTheme();

    return (
        <div
            className={`${styles.mainContainer} ${className ?? ''}`}
            data-khorne-workspace={theme === 'khorne' ? '' : undefined}
        >
            <MainTaskContentPanel className={styles.taskContentPanelContainer}/>
            <MainCodeEditor className={styles.codeEditor}>
            </MainCodeEditor>
        </div>
    )
}
