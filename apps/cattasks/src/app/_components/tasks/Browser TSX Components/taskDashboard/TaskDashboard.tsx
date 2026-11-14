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
                <div className={`${styles.shelf} ${isAllTasksOpen ? styles.catalogueShelf : styles.taskShelf}`} aria-hidden="true">
                    {!isAllTasksOpen && (
                        <>
                        <div className={styles.shelfDecoration}>
                            <span className={`${styles.shelfBracket} ${styles.shelfBracketLeft}`}/>
                            <span className={`${styles.shelfBracket} ${styles.shelfBracketRight}`}/>
                            <img className={styles.shelfPlantPreviousLeft} src="/cattasks/shelf/plant-prev-left.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantPreviousRight} src="/cattasks/shelf/plant-prev-right.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantNextLeft} src="/cattasks/shelf/plant-next-left.png" alt="" loading="lazy"/>
                            <img className={styles.shelfPlantNextRight} src="/cattasks/shelf/plant-next-right.png" alt="" loading="lazy"/>
                            <img className={styles.shelfLeafPair} src="/cattasks/shelf/leaf-pair.png" alt="" loading="lazy"/>
                            <img className={styles.shelfOwl} src="/cattasks/shelf/owl.png" alt="" loading="lazy"/>
                        </div>
                        <div className={styles.mobileShelfDecoration}>
                            <img className={styles.mobileShelfArt} data-mobile-shelf-art="books" src="/cattasks/mobile-shelf/books.png" alt="" loading="lazy"/>
                            <img className={styles.mobileShelfArt} data-mobile-shelf-art="fan" src="/cattasks/mobile-shelf/fan.png" alt="" loading="lazy"/>
                            <img className={styles.mobileShelfArt} data-mobile-shelf-art="lantern" src="/cattasks/mobile-shelf/lantern.png" alt="" loading="lazy"/>
                            <img className={styles.mobileShelfArt} data-mobile-shelf-art="vine" src="/cattasks/mobile-shelf/vine.png" alt="" loading="lazy"/>
                            <img className={styles.mobileShelfArt} data-mobile-shelf-art="crystals" src="/cattasks/mobile-shelf/crystals.png" alt="" loading="lazy"/>
                            <img className={styles.mobileShelfArt} data-mobile-shelf-art="sprig" src="/cattasks/mobile-shelf/sprig.png" alt="" loading="lazy"/>
                        </div>
                        </>
                    )}
                    {isAllTasksOpen && (
                        <div className={styles.catalogueShelfDecoration}>
                            <span className={`${styles.catalogueShelfBracket} ${styles.catalogueShelfBracketLeft}`}/>
                            <span className={`${styles.catalogueShelfBracket} ${styles.catalogueShelfBracketRight}`}/>
                        </div>
                    )}
                </div>
                {/* Keep Monaco mounted while browsing so opening the catalogue cannot abort its worker. */}
                <Main className={`${styles.mainContainer} ${isAllTasksOpen ? styles.hiddenMain : ''}`}/>
                {isAllTasksOpen && <AllTasks onBack={returnToTask}/>}
                <Footer className={styles.footerContainer}></Footer>
            </div>
        </TaskProvider>
    );
}
