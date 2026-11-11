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
                </div>
                <div className={styles.viewportDecoration} aria-hidden="true">
                    <span className={styles.foliageTopRight}/>
                    <span className={styles.foliageBottomLeft}/>
                    <span className={styles.foliageBottomRight}/>
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
                <div className={`${styles.shelf} ${isAllTasksOpen ? '' : styles.taskShelf}`} aria-hidden="true">
                    {!isAllTasksOpen && (
                        <div className={styles.shelfDecoration}>
                            <span className={`${styles.shelfBracket} ${styles.shelfBracketLeft}`}/>
                            <span className={`${styles.shelfBracket} ${styles.shelfBracketRight}`}/>
                            <img className={styles.shelfBooks} src="/cattasks/shelf/books_standing.png" alt="" loading="lazy"/>
                            <img className={styles.shelfMug} src="/cattasks/shelf/mug_paw.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantBooks} src="/cattasks/shelf/plant-books.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantPreviousLeft} src="/cattasks/shelf/plant-prev-left.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantPreviousRight} src="/cattasks/shelf/plant-prev-right.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantNextLeft} src="/cattasks/shelf/plant-next-left.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantNextRight} src="/cattasks/shelf/plant-next-right.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantCup} src="/cattasks/shelf/plant-cup.png" alt="" loading="lazy"/>
                            <img className={styles.shelfLeafPair} src="/cattasks/shelf/leaf-pair.png" alt="" loading="lazy"/>
                        </div>
                    )}
                </div>
                {/* Keep Monaco mounted while browsing so opening the catalogue cannot abort its worker. */}
                <Main className={`${styles.mainContainer} ${isAllTasksOpen ? styles.hiddenMain : ''}`}/>
                {isAllTasksOpen && <AllTasks className={styles.mainContainer} onBack={returnToTask}/>}
                <Footer className={styles.footerContainer}></Footer>
            </div>
        </TaskProvider>
    );
}
