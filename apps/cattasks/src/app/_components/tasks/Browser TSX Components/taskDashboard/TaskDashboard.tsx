'use client';
import styles from './TaskDashboard.module.css';
import Header from '@/app/_components/tasks/Browser TSX Components/header/Header';
import Main from '@/app/_components/tasks/Browser TSX Components/main/Main';
import Footer from '@/app/_components/tasks/Browser TSX Components/footer/Footer';
import {TaskProvider} from '../../context/TaskProvider';
import {useCallback, useRef, useState} from 'react';
import AllTasks, {AllTasksHeader} from '@/app/_components/tasks/Browser TSX Components/allTasks/AllTasks';

export default function TaskDashboard() {
    const [isAllTasksOpen, setIsAllTasksOpen] = useState(false);
    const allTasksButtonRef = useRef<HTMLButtonElement>(null);
    const showAllTasks = useCallback(() => setIsAllTasksOpen(true), []);
    const returnToTask = useCallback(() => {
        setIsAllTasksOpen(false);
        requestAnimationFrame(() => allTasksButtonRef.current?.focus());
    }, []);

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
                {isAllTasksOpen ? (
                    <AllTasksHeader className={styles.headerContainer} onBack={returnToTask}/>
                ) : (
                    <Header
                        className={styles.headerContainer}
                        onShowAllTasks={showAllTasks}
                        allTasksButtonRef={allTasksButtonRef}
                    />
                )}
                <div className={styles.shelf} aria-hidden="true"/>
                {/* Keep Monaco mounted while browsing so opening the catalogue cannot abort its worker. */}
                <Main className={`${styles.mainContainer} ${isAllTasksOpen ? styles.hiddenMain : ''}`}/>
                {isAllTasksOpen && <AllTasks className={styles.mainContainer} onBack={returnToTask}/>}
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
