import TaskDashboard from '@/app/_components/tasks/Browser TSX Components/taskDashboard/TaskDashboard';
import styles from './page.module.css';


export default function Home() {
    return (
        <div className={styles.background}>
            <div className={styles.pageDashboardRoot}>
                <TaskDashboard/>
            </div>
        </div>
    );
}