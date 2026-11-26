'use client';

import type {RefObject} from 'react';
import {useTaskContext} from '../../context/TaskProvider';
import styles from './KhorneHeader.module.css';
import UnifiedTaskHeader, {Artwork, SlicedArtwork, warhammerAquilaSrc, type WarhammerHeaderTheme} from './UnifiedTaskHeader';
import taskHeaderStyles from './UnifiedTaskHeader.module.css';

type KhorneDashboardHeaderProps = {
    readonly className?: string;
    readonly isAllTasksOpen: boolean;
    readonly onAllTasks: () => void;
    readonly onBack: () => void;
    readonly allTasksButtonRef: RefObject<HTMLButtonElement | null>;
    readonly theme?: WarhammerHeaderTheme;
};

type KhorneHeaderProps = {
    readonly className?: string;
    readonly mode: 'task' | 'catalogue';
    readonly onAllTasks?: () => void;
    readonly onBack?: () => void;
    readonly allTasksButtonRef?: RefObject<HTMLButtonElement | null>;
    readonly theme?: WarhammerHeaderTheme;
};

type WarhammerCatalogHeaderProps = {
    readonly className?: string;
    readonly onBack?: () => void;
    readonly theme?: WarhammerHeaderTheme;
};

const noop = () => undefined;
const emptyButtonRef: RefObject<HTMLButtonElement | null> = {current: null};

function KhorneCatalogueHeader({className, onBack, theme = 'khorne'}: WarhammerCatalogHeaderProps) {
    return (
        <div className={`${styles.catalogueShell} ${className ?? ''}`} data-warhammer-variant={theme}>
            <header className={styles.catalogueHeader} data-khorne-header="catalogue" data-warhammer-variant={theme}>
                <div className={styles.catalogueSurface} aria-hidden="true">
                    <span className={`${styles.catalogueVentShell} ${styles.catalogueVentLeft}`}><SlicedArtwork name="vent-frame.png" cap={.13} className={`${styles.catalogueVentFrame} ${taskHeaderStyles.metal}`}/><span className={styles.catalogueVent} data-khorne-vent="" data-warhammer-variant={theme}/></span>
                    <span className={`${styles.catalogueVentShell} ${styles.catalogueVentRight}`}><SlicedArtwork name="vent-frame.png" cap={.13} className={`${styles.catalogueVentFrame} ${taskHeaderStyles.metal}`}/><span className={styles.catalogueVent} data-khorne-vent="" data-warhammer-variant={theme}/></span>
                    <span className={styles.catalogueAquilaBacking}/>
                </div>
                <div className={styles.cataloguePlaque}>
                    <SlicedArtwork name="back-button-mount.png" cap={.2} className={`${styles.catalogueMount} ${taskHeaderStyles.metal}`}/>
                    <h1 className={styles.title}>All tasks</h1>
                </div>
                <span className={styles.aquila} data-khorne-aquila="" data-warhammer-variant={theme} aria-hidden="true">
                    <img src={warhammerAquilaSrc[theme]} alt="" draggable={false}/>
                </span>
                <button type="button" className={styles.catalogueBack} onClick={onBack}><span className={styles.backFace} aria-hidden="true"><Artwork name="control-metal-face.png"/></span><SlicedArtwork name="back-button-housing.png" cap={.2} className={`${styles.backFrame} ${taskHeaderStyles.metal}`}/><span className={styles.backCopy}><span aria-hidden="true">←</span>Back to task</span></button>
            </header>
        </div>
    );
}

export function WarhammerCatalogHeader({className, onBack, theme = 'khorne'}: WarhammerCatalogHeaderProps) {
    return <KhorneDashboardHeader className={className} isAllTasksOpen onAllTasks={noop} onBack={onBack ?? noop} allTasksButtonRef={emptyButtonRef} theme={theme}/>;
}

export function KhorneDashboardHeader({className, isAllTasksOpen, onAllTasks, onBack, allTasksButtonRef, theme = 'khorne'}: KhorneDashboardHeaderProps) {
    const {tasks, catalogError, selectedTask, selectPreviousTask, selectNextTask} = useTaskContext();
    const hasTasks = tasks.length > 0;
    const selectedIndex = selectedTask ? tasks.findIndex(task => task.id === selectedTask.id) : -1;
    const previousDisabled = selectedIndex <= 0;
    const nextDisabled = !hasTasks || selectedIndex >= tasks.length - 1;
    const title = selectedTask
        ? selectedTask.title
        : catalogError
            ? 'Tasks unavailable.'
            : hasTasks
                ? 'No task selected.'
                : 'Loading tasks…';

    return <div className={`${styles.dashboardShell} ${isAllTasksOpen ? styles.catalogueDashboardShell : ''} ${className ?? ''}`} data-cattasks-header="" data-warhammer-variant={theme}>
        {isAllTasksOpen ? <KhorneCatalogueHeader onBack={onBack} theme={theme}/> : <UnifiedTaskHeader
            taskNumber={selectedTask?.ordinal}
            title={title}
            onPrevious={() => {
                if (!previousDisabled) selectPreviousTask();
            }}
            onNext={() => {
                if (!nextDisabled) selectNextTask();
            }}
            onBack={onAllTasks}
            previousDisabled={previousDisabled}
            nextDisabled={nextDisabled}
            backButtonRef={allTasksButtonRef}
            showRail={false}
            theme={theme}
        />}
        <SlicedArtwork name="beam.png" cap={.075} className={`${taskHeaderStyles.beam} ${taskHeaderStyles.metal} ${styles.catalogueRail}`} khorneRail theme={theme}/>
    </div>;
}

export default function KhorneHeader({className, mode, onAllTasks, onBack, allTasksButtonRef, theme = 'khorne'}: KhorneHeaderProps) {
    return <KhorneDashboardHeader
        className={className}
        isAllTasksOpen={mode === 'catalogue'}
        onAllTasks={onAllTasks ?? noop}
        onBack={onBack ?? noop}
        allTasksButtonRef={allTasksButtonRef ?? emptyButtonRef}
        theme={theme}
    />;
}
