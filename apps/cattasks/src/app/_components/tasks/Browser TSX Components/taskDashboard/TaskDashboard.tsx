import styles from './TaskDashboard.module.css';
import Header from '@/app/_components/tasks/Browser TSX Components/header/Header';
import Main from '@/app/_components/tasks/Browser TSX Components/main/Main';
import Footer from '@/app/_components/tasks/Browser TSX Components/footer/Footer';
import {TaskProvider} from '../../context/TaskProvider';

export default function TaskDashboard() {
    return (
        <TaskProvider>
            <div className={styles.taskDashboardRoot}>
                <Header className={styles.headerContainer}></Header>
                <Main className={styles.mainContainer}></Main>
                <Footer className={styles.footerContainer}></Footer>
            </div>
        </TaskProvider>
    );
}
