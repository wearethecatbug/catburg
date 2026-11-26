'use client';
import styles from './TaskDashboard.module.css';
import {KhorneDashboardHeader} from '@/app/_components/tasks/Browser TSX Components/header/KhorneHeader';
import CapybaraHeader from '@/app/_components/tasks/Browser TSX Components/header/v146/CapybaraHeader';
import Main from '@/app/_components/tasks/Browser TSX Components/main/Main';
import Footer from '@/app/_components/tasks/Browser TSX Components/footer/Footer';
import {TaskProvider} from '../../context/TaskProvider';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import AllTasks from '@/app/_components/tasks/Browser TSX Components/allTasks/AllTasks';
import {CatTasksThemeContext, catTasksThemes, getCatTasksTheme, isWarhammerTheme, type CatTasksTheme} from './CatTasksTheme';
import ThemeToggle from './ThemeToggle';
import type {V146Construction} from '@/app/_components/tasks/Browser TSX Components/header/v146/V146Header';
import {getWorkspaceHeaderEnvelope} from '@/app/_components/tasks/Browser TSX Components/header/v146/pure/workspace/header-placement.mjs';

const THEME_STORAGE_KEY = 'cattasks-theme';
const themePrepaintScript = `try{const theme=window.localStorage.getItem('cattasks-theme');const allowed=${JSON.stringify(catTasksThemes)};if(allowed.includes(theme))document.currentScript?.parentElement?.setAttribute('data-cattasks-theme',theme)}catch{}`;

function KhorneFigure({figure, src}: {figure: string; src: string}) {
    return <span className={styles.khorneFigure} data-khorne-figure={figure}><img className={styles.khorneFigureArt} src={src} alt="" loading="lazy" decoding="async"/></span>;
}

function NurgleFigure({figure, src}: {figure: string; src: string}) {
    return <span className={styles.nurgleFigure} data-nurgle-figure={figure}><img className={styles.nurgleFigureArt} src={src} alt="" loading="lazy" decoding="async"/></span>;
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
    const [hasVisitedAllTasks, setHasVisitedAllTasks] = useState(false);
    const [theme, setTheme] = useState<CatTasksTheme>('light');
    const [headerConstruction, setHeaderConstruction] = useState<V146Construction>('industrial');
    const dashboardRef = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const allTasksButtonRef = useRef<HTMLButtonElement>(null);
    const [workspaceLayout, setWorkspaceLayout] = useState({width: 0, baseline: 0, slot: 0});
    const showAllTasks = useCallback(() => {
        setHasVisitedAllTasks(true);
        setIsAllTasksOpen(true);
    }, []);
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
        const workspace = workspaceRef.current;
        if (!workspace) return;

        const update = () => {
            const width = Math.floor(workspace.getBoundingClientRect().width);
            const envelope = getWorkspaceHeaderEnvelope(width);
            const baseline = envelope.baseline;
            const slot = envelope.height + 3;
            workspace.style.setProperty('--workspace-header-slot', `${slot}px`);
            setWorkspaceLayout(current => current.width === width && current.baseline === baseline && current.slot === slot ? current : {width, baseline, slot});
        };
        const observer = new ResizeObserver(update);
        observer.observe(workspace);
        update();
        return () => observer.disconnect();
    }, [theme]);

    useLayoutEffect(() => {
        if (!isWarhammerTheme(theme) || !isAllTasksOpen) return;

        const dashboard = dashboardRef.current;
        if (!dashboard) return;

        const sidebar = dashboard.querySelector<HTMLElement>('aside');
        const taskList = dashboard.querySelector<HTMLElement>("[aria-labelledby='taskListTitle']");
        const marine = dashboard.querySelector<HTMLElement>(`[data-${theme}-figure-scene='all-tasks'] > [data-${theme}-figure='catalogue-marine']`);
        const daemon = dashboard.querySelector<HTMLElement>(`[data-${theme}-figure-scene='all-tasks'] > [data-${theme}-figure='catalogue-daemon']`);
        if (!sidebar || !taskList || !marine || !daemon) return;

        const figures = [marine, daemon];
        const clearClips = () => figures.forEach((figure) => {
            delete figure.dataset[`${theme}CatalogueClipped`];
            figure.style.removeProperty(`--${theme}-catalogue-clip-top`);
            figure.style.removeProperty(`--${theme}-catalogue-clip-bottom`);
            figure.style.removeProperty(`--${theme}-catalogue-clip-edge`);
        });
        const constrain = (figure: HTMLElement, edge: number, top: number, bottom: number) => {
            const bounds = figure.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const clipTop = Math.max(0, Math.min(bounds.height, top - bounds.top));
            const clipBottom = Math.max(clipTop, Math.min(bounds.height, bottom - bounds.top));
            if (clipTop === clipBottom) return;
            figure.dataset[`${theme}CatalogueClipped`] = 'true';
            figure.style.setProperty(`--${theme}-catalogue-clip-top`, `${clipTop}px`);
            figure.style.setProperty(`--${theme}-catalogue-clip-bottom`, `${clipBottom}px`);
            figure.style.setProperty(`--${theme}-catalogue-clip-edge`, `${Math.max(0, Math.min(bounds.width, edge - bounds.left))}px`);
        };
        const update = () => {
            clearClips();
            if (!window.matchMedia('(min-width: 2200px) and (min-height: 740px)').matches) return;

            const sidebarBounds = sidebar.getBoundingClientRect();
            const listBounds = taskList.getBoundingClientRect();
            const panelTop = Math.min(sidebarBounds.top, listBounds.top);
            const panelBottom = Math.max(sidebarBounds.bottom, listBounds.bottom);
            // The approved rim overlap is 11px; below the panels silhouettes remain uncut over the track.
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
                <div className={styles.nurgleScene} data-nurgle-scene={isAllTasksOpen ? 'all-tasks' : 'task'} aria-hidden="true"/>
                {theme === 'khorne' && <div className={styles.khorneFigureLayer} aria-hidden="true">
                    <div data-khorne-figure-scene="task">
                        <KhorneFigure figure="task-marine" src="/cattasks/themes/khorne/task/marine.webp"/>
                        <KhorneFigure figure="task-hound-upper" src="/cattasks/themes/khorne/task/daemon.webp"/>
                        <KhorneFigure figure="task-hound-lower" src="/cattasks/themes/khorne/task/daemon.webp"/>
                    </div>
                    <div data-khorne-figure-scene="all-tasks">
                        <KhorneFigure figure="catalogue-marine" src="/cattasks/themes/khorne/all-tasks/marine.webp"/>
                        <KhorneFigure figure="catalogue-daemon" src="/cattasks/themes/khorne/all-tasks/daemon.webp"/>
                    </div>
                </div>}
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
                <div
                    ref={workspaceRef}
                    className={styles.workspaceFrame}
                    data-cattasks-workspace={workspaceLayout.width || undefined}
                    data-header-baseline={workspaceLayout.baseline}
                >
                    {isWarhammerTheme(theme) ? (
                        <KhorneDashboardHeader
                            className={styles.headerContainer}
                            theme={theme}
                            construction={headerConstruction}
                            workspaceWidth={workspaceLayout.width || 320}
                            isAllTasksOpen={isAllTasksOpen}
                            onAllTasks={showAllTasks}
                            onBack={returnToTask}
                            allTasksButtonRef={allTasksButtonRef}
                        />
                    ) : (
                        <CapybaraHeader
                            className={styles.headerContainer}
                            isAllTasksOpen={isAllTasksOpen}
                            onAllTasks={showAllTasks}
                            onBack={returnToTask}
                            allTasksButtonRef={allTasksButtonRef}
                            workspaceWidth={workspaceLayout.width || 320}
                        />
                    )}
                    <ThemeToggle construction={headerConstruction} onConstructionChange={setHeaderConstruction}/>
                    {/* Keep Monaco mounted while browsing so opening the catalogue cannot abort its worker. */}
                    <Main className={`${styles.mainContainer} ${isAllTasksOpen ? styles.hiddenMain : ''}`}/>
                    {hasVisitedAllTasks && <div className={styles.catalogueView} hidden={!isAllTasksOpen}><AllTasks onBack={returnToTask} isOpen={isAllTasksOpen}/></div>}
                </div>
                <Footer className={styles.footerContainer}></Footer>
                {theme === 'khorne' && <div className={styles.khorneLowerScene} data-khorne-scene-layout="lower" aria-hidden="true">
                    <div data-khorne-figure-scene="task">
                        <KhorneFigure figure="task-marine" src="/cattasks/themes/khorne/task/marine.webp"/>
                        <KhorneFigure figure="task-hound-upper" src="/cattasks/themes/khorne/task/daemon.webp"/>
                        <KhorneFigure figure="task-hound-lower" src="/cattasks/themes/khorne/task/daemon.webp"/>
                    </div>
                    <div data-khorne-figure-scene="all-tasks">
                        <KhorneFigure figure="catalogue-marine" src="/cattasks/themes/khorne/all-tasks/marine.webp"/>
                        <KhorneFigure figure="catalogue-daemon" src="/cattasks/themes/khorne/all-tasks/daemon.webp"/>
                    </div>
                </div>}
                {theme === 'nurgle' && <div className={styles.nurgleFigureStage} data-nurgle-figure-scene={isAllTasksOpen ? 'all-tasks' : 'task'} aria-hidden="true">
                    {isAllTasksOpen ? <>
                        <NurgleFigure figure="catalogue-marine" src="/cattasks/themes/nurgle/all-tasks/marine.webp"/>
                        <NurgleFigure figure="catalogue-daemon" src="/cattasks/themes/nurgle/all-tasks/daemon.webp"/>
                    </> : <>
                        <NurgleFigure figure="task-marine" src="/cattasks/themes/nurgle/task/marine.webp"/>
                        <NurgleFigure figure="task-daemon" src="/cattasks/themes/nurgle/task/daemon.webp"/>
                    </>}
                </div>}
            </div>
            </CatTasksThemeContext.Provider>
        </TaskProvider>
    );
}
