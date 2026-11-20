'use client';
import styles from './TaskDashboard.module.css';
import Header from '@/app/_components/tasks/Browser TSX Components/header/Header';
import {KhorneDashboardHeader} from '@/app/_components/tasks/Browser TSX Components/header/KhorneHeader';
import Main from '@/app/_components/tasks/Browser TSX Components/main/Main';
import Footer from '@/app/_components/tasks/Browser TSX Components/footer/Footer';
import {TaskProvider} from '../../context/TaskProvider';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import AllTasks, {AllTasksHeader} from '@/app/_components/tasks/Browser TSX Components/allTasks/AllTasks';
import {CatTasksThemeContext, catTasksThemes, getCatTasksTheme, type CatTasksTheme} from './CatTasksTheme';
import ThemeToggle from './ThemeToggle';

const THEME_STORAGE_KEY = 'cattasks-theme';
const themePrepaintScript = `try{const theme=window.localStorage.getItem('cattasks-theme');const allowed=${JSON.stringify(catTasksThemes)};if(allowed.includes(theme))document.currentScript?.parentElement?.setAttribute('data-cattasks-theme',theme)}catch{}`;

function KhorneFigure({figure, src}: {figure: string; src: string}) {
    return <span className={styles.khorneFigure} data-khorne-figure={figure}><img className={styles.khorneFigureArt} src={src} alt="" loading="lazy" decoding="async"/></span>;
}

function readStoredTheme(): CatTasksTheme {
    try {
        return getCatTasksTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
        return 'light';
    }
}

export default function TaskDashboard() {
    const [isAllTasksOpen, setIsAllTasksOpen] = useState(false);
    const [theme, setTheme] = useState<CatTasksTheme>('light');
    const dashboardRef = useRef<HTMLDivElement>(null);
    const allTasksButtonRef = useRef<HTMLButtonElement>(null);
    const showAllTasks = useCallback(() => setIsAllTasksOpen(true), []);
    const returnToTask = useCallback(() => {
        setIsAllTasksOpen(false);
        requestAnimationFrame(() => allTasksButtonRef.current?.focus());
    }, []);
    useEffect(() => {
        setTheme(readStoredTheme());
    }, []);
    const selectTheme = useCallback((nextTheme: CatTasksTheme) => {
        setTheme(nextTheme);
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
            // Storage is optional: a visible local selection still works for this session.
        }
    }, []);
    const themeValue = useMemo(() => ({theme, setTheme: selectTheme}), [theme, selectTheme]);

    useLayoutEffect(() => {
        if (theme !== 'khorne' || !isAllTasksOpen) return;

        const dashboard = dashboardRef.current;
        if (!dashboard) return;

        const sidebar = dashboard.querySelector<HTMLElement>('aside');
        const taskList = dashboard.querySelector<HTMLElement>("[aria-labelledby='taskListTitle']");
        const marine = dashboard.querySelector<HTMLElement>("[data-khorne-figure-scene='all-tasks'] > [data-khorne-figure='catalogue-marine']");
        const daemon = dashboard.querySelector<HTMLElement>("[data-khorne-figure-scene='all-tasks'] > [data-khorne-figure='catalogue-daemon']");
        if (!sidebar || !taskList || !marine || !daemon) return;

        const figures = [marine, daemon];
        const clearClips = () => figures.forEach((figure) => {
            delete figure.dataset.khorneCatalogueClipped;
            figure.style.removeProperty('--khorne-catalogue-clip-top');
            figure.style.removeProperty('--khorne-catalogue-clip-bottom');
            figure.style.removeProperty('--khorne-catalogue-clip-edge');
        });
        const constrain = (figure: HTMLElement, edge: number, top: number, bottom: number) => {
            const bounds = figure.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const clipTop = Math.max(0, Math.min(bounds.height, top - bounds.top));
            const clipBottom = Math.max(clipTop, Math.min(bounds.height, bottom - bounds.top));
            if (clipTop === clipBottom) return;
            figure.dataset.khorneCatalogueClipped = 'true';
            figure.style.setProperty('--khorne-catalogue-clip-top', `${clipTop}px`);
            figure.style.setProperty('--khorne-catalogue-clip-bottom', `${clipBottom}px`);
            figure.style.setProperty('--khorne-catalogue-clip-edge', `${Math.max(0, Math.min(bounds.width, edge - bounds.left))}px`);
        };
        const update = () => {
            clearClips();
            if (!window.matchMedia('(min-width: 2200px) and (min-height: 740px)').matches) return;

            const sidebarBounds = sidebar.getBoundingClientRect();
            const listBounds = taskList.getBoundingClientRect();
            const panelTop = Math.min(sidebarBounds.top, listBounds.top);
            const panelBottom = Math.max(sidebarBounds.bottom, listBounds.bottom);
            // The approved rim overlap is 11px; below the panels the sword remains uncut over the track.
            constrain(marine, sidebarBounds.left + 11, panelTop, panelBottom);
            constrain(daemon, listBounds.right - 11, panelTop, panelBottom);
        };

        let frame = 0;
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(update);
        };
        const observer = new ResizeObserver(schedule);
        observer.observe(dashboard);
        observer.observe(sidebar);
        observer.observe(taskList);
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, {capture: true, passive: true});
        schedule();

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
            clearClips();
        };
    }, [isAllTasksOpen, theme]);

    return (
        <TaskProvider>
            <CatTasksThemeContext.Provider value={themeValue}>
            <div ref={dashboardRef} className={styles.taskDashboardRoot} data-cattasks-theme={theme} data-cattasks-page={isAllTasksOpen ? 'all-tasks' : 'task'} suppressHydrationWarning>
                <script dangerouslySetInnerHTML={{__html: themePrepaintScript}}/>
                <div className={styles.khorneScene} data-khorne-scene="task" aria-hidden="true"/>
                <div className={styles.khorneScene} data-khorne-scene="all-tasks" aria-hidden="true"/>
                <div className={styles.khorneFigureLayer} aria-hidden="true">
                    <div data-khorne-figure-scene="task">
                        <KhorneFigure figure="task-marine" src="/cattasks/themes/khorne/task/marine.webp"/>
                        <KhorneFigure figure="task-hound-upper" src="/cattasks/themes/khorne/task/daemon.webp"/>
                        <KhorneFigure figure="task-hound-lower" src="/cattasks/themes/khorne/task/daemon.webp"/>
                    </div>
                    <div data-khorne-figure-scene="all-tasks">
                        <KhorneFigure figure="catalogue-marine" src="/cattasks/themes/khorne/all-tasks/marine.webp"/>
                        <KhorneFigure figure="catalogue-daemon" src="/cattasks/themes/khorne/all-tasks/daemon.webp"/>
                    </div>
                </div>
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
                {theme === 'khorne' ? (
                    <KhorneDashboardHeader
                        className={styles.headerContainer}
                        isAllTasksOpen={isAllTasksOpen}
                        onAllTasks={showAllTasks}
                        onBack={returnToTask}
                        allTasksButtonRef={allTasksButtonRef}
                    />
                ) : isAllTasksOpen ? (
                    <AllTasksHeader className={styles.headerContainer} onBack={returnToTask}/>
                ) : (
                    <Header
                        className={styles.headerContainer}
                        onShowAllTasks={showAllTasks}
                        allTasksButtonRef={allTasksButtonRef}
                    />
                )}
                <ThemeToggle/>
                {theme !== 'khorne' && <div className={`${styles.shelf} ${isAllTasksOpen ? styles.catalogueShelf : styles.taskShelf}`} aria-hidden="true">
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
                            <span className={styles.shelfBooks}/>
                            <span className={styles.shelfLantern}/>
                            <span className={styles.shelfHouse}/>
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
                </div>}
                {/* Keep Monaco mounted while browsing so opening the catalogue cannot abort its worker. */}
                <Main className={`${styles.mainContainer} ${isAllTasksOpen ? styles.hiddenMain : ''}`}/>
                {isAllTasksOpen && <AllTasks onBack={returnToTask}/>}
                <Footer className={styles.footerContainer}></Footer>
                <div className={styles.khorneLowerScene} data-khorne-scene-layout="lower" aria-hidden="true">
                    <div data-khorne-figure-scene="task">
                        <KhorneFigure figure="task-marine" src="/cattasks/themes/khorne/task/marine.webp"/>
                        <KhorneFigure figure="task-hound-upper" src="/cattasks/themes/khorne/task/daemon.webp"/>
                        <KhorneFigure figure="task-hound-lower" src="/cattasks/themes/khorne/task/daemon.webp"/>
                    </div>
                    <div data-khorne-figure-scene="all-tasks">
                        <KhorneFigure figure="catalogue-marine" src="/cattasks/themes/khorne/all-tasks/marine.webp"/>
                        <KhorneFigure figure="catalogue-daemon" src="/cattasks/themes/khorne/all-tasks/daemon.webp"/>
                    </div>
                </div>
            </div>
            </CatTasksThemeContext.Provider>
        </TaskProvider>
    );
}
