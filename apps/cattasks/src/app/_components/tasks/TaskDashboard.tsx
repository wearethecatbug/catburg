import styles from './TaskDashboard.module.css';
import Header from '@/app/_components/tasks/Header';
import Main from '@/app/_components/tasks/Main';
import Footer from '@/app/_components/tasks/Footer';

export default function TaskDashboard() {
    return (
        <div className={styles.tdContainer}>
            <Header className={styles.headerContainer}></Header>
            <Main className={styles.mainContainer}></Main>
            <Footer className={styles.footerContainer}></Footer>
        </div>
    );
}