import styles from './Main.module.css';
import MainTaskDetails from "@/app/_components/tasks/MainTaskDetails";
import MainCodeEditor from "@/app/_components/tasks/MainCodeEditor";

interface MainProps {
    readonly className?: string;
}

export default function Main({className}: MainProps) {
    return (
        <div className={`${styles.mainContainer} ${className ?? ''}`}>
            <MainTaskDetails className={styles.taskDetails}/>
            <MainCodeEditor className={styles.codeEditor}/>
        </div>
    );
}