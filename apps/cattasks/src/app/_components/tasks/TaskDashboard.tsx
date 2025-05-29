import Header from '@/app/_components/tasks/Header';
import styles from './TaskDashboard.module.css';

export default function TaskDashboard() {
    return (
        <div className={styles.tdContainer}>
            <Header className={styles.headerContainer}></Header>
            {/*<Main></Main>*/}
            {/*<Footer></Footer>*/}
        </div>
    );
}