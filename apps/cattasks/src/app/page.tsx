import TaskDashboard from '@/app/_components/tasks/Browser TSX Components/TaskDashboard/TaskDashboard';
import {TaskProvider} from '@/app/_components/tasks/Context/TaskProvider';
import styles from './page.module.css';


export default function Home() {
    return (
        <div className={styles.background}>
            <div className={styles.tdContainer}>
                <TaskProvider>
                    <TaskDashboard/>
                </TaskProvider>
            </div>
        </div>
    );
}