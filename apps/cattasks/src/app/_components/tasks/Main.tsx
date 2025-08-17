import styles from './Main.module.css';
import MainTaskDetails from "@/app/_components/tasks/MainTaskDetails";
import MainCodeEditor from "@/app/_components/tasks/MainCodeEditor";

interface MainProps {
    readonly className?: string;
    readonly children?: React.ReactNode;
}

export default function Main({className, children}: MainProps) {
    return (
        <div className={styles.mainContainer}>
            <MainTaskDetails className={styles.taskDetails}/>
            <MainCodeEditor className={styles.codeEditor}/>
        </div>
    )
}