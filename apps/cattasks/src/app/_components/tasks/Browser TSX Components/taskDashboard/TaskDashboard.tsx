import styles from './TaskDashboard.module.css';
import Header from '@/app/_components/tasks/Browser TSX Components/header/Header';
import Main from '@/app/_components/tasks/Browser TSX Components/main/Main';
import Footer from '@/app/_components/tasks/Browser TSX Components/footer/Footer';
import {TaskProvider} from '../../context/TaskProvider';

export default function TaskDashboard() {
    return (
        <TaskProvider>
            <div className={styles.taskDashboardRoot}>
                <div className={styles.decorationLayer} aria-hidden="true">
                    <span className={styles.ambientLight}/>
                    <span className={styles.windowLight}>
                        <span/><span/><span/><span/><span/><span/>
                    </span>
                    <span className={styles.foliageTopRight}/>
                </div>
                <Header className={styles.headerContainer}></Header>
                <div className={styles.shelf} aria-hidden="true"/>
                <Main className={styles.mainContainer}></Main>
                <Footer className={styles.footerContainer}></Footer>
                <div className={styles.deskEdgeDecoration} aria-hidden="true">
                    <span className={styles.foliageBottomLeft}/>
                    <span className={styles.foliageBottomRight}/>
                    <span className={styles.grassOne}/>
                    <span className={styles.grassTwo}/>
                    <span className={styles.grassThree}/>
                </div>
            </div>
        </TaskProvider>
    );
}
