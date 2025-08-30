// "use client";
import TaskDashboard from "@/app/_components/tasks/Browser TSX Components/TaskDashboard/TaskDashboard";
import styles from './page.module.css';


export default function Home() {
    return (
        <div className={styles.background}>
            <div className={styles.tdContainer}>
                <TaskDashboard/>
            </div>
        </div>
    );
}