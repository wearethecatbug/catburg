'use client';

import type {RefObject} from 'react';
import {useTaskContext} from '../../context/TaskProvider';
import styles from './KhorneHeader.module.css';
import UnifiedTaskHeader, {Artwork, SlicedArtwork} from './UnifiedTaskHeader';
import taskHeaderStyles from './UnifiedTaskHeader.module.css';

type KhorneDashboardHeaderProps = {
    readonly className?: string;
    readonly isAllTasksOpen: boolean;
    readonly onAllTasks: () => void;
    readonly onBack: () => void;
    readonly allTasksButtonRef: RefObject<HTMLButtonElement | null>;
};

type KhorneHeaderProps = {
    readonly className?: string;
    readonly mode: 'task' | 'catalogue';
    readonly onAllTasks?: () => void;
    readonly onBack?: () => void;
    readonly allTasksButtonRef?: RefObject<HTMLButtonElement | null>;
};

type WarhammerCatalogHeaderProps = {
    readonly className?: string;
    readonly onBack?: () => void;
};

const noop = () => undefined;
const emptyButtonRef: RefObject<HTMLButtonElement | null> = {current: null};

function KhorneCatalogueHeader({className, onBack}: WarhammerCatalogHeaderProps) {
    return (
        <div className={`${styles.catalogueShell} ${className ?? ''}`}>
            <header className={styles.catalogueHeader} data-khorne-header="catalogue">
                <div className={styles.catalogueSurface} aria-hidden="true">
                    <SlicedArtwork name="header-base.png" cap={.07} className={`${styles.catalogueBase} ${taskHeaderStyles.metal}`}/>
                    <span className={`${styles.catalogueVentShell} ${styles.catalogueVentLeft}`}><SlicedArtwork name="vent-frame.png" cap={.13} className={`${styles.catalogueVentFrame} ${taskHeaderStyles.metal}`}/><span className={styles.catalogueVent} data-khorne-vent=""/></span>
                    <span className={`${styles.catalogueVentShell} ${styles.catalogueVentRight}`}><SlicedArtwork name="vent-frame.png" cap={.13} className={`${styles.catalogueVentFrame} ${taskHeaderStyles.metal}`}/><span className={styles.catalogueVent} data-khorne-vent=""/></span>
                </div>
                <div className={styles.cataloguePlaque}>
                    <SlicedArtwork name="back-button-mount.png" cap={.2} className={`${styles.catalogueMount} ${taskHeaderStyles.metal}`}/>
                    <h1 className={styles.title}>All tasks</h1>
                </div>
                <span className={styles.aquila} data-khorne-aquila="" aria-hidden="true">
                    <img src="/cattasks/themes/khorne/task-header/aquila-ruby.png" alt="" draggable={false}/>
                </span>
                <div className={styles.catalogueBackMount} aria-hidden="true"><SlicedArtwork name="back-button-mount.png" cap={.2} className={`${styles.catalogueMount} ${taskHeaderStyles.metal}`}/></div>
                <button type="button" className={styles.catalogueBack} onClick={onBack}><span className={styles.backFace} aria-hidden="true"><Artwork name="control-metal-face.png"/></span><SlicedArtwork name="back-button-housing.png" cap={.2} className={`${styles.backFrame} ${taskHeaderStyles.metal}`}/><span className={styles.backCopy}><span aria-hidden="true">←</span>Back to task</span></button>
            </header>
        </div>
    );
}

export function WarhammerCatalogHeader({className, onBack}: WarhammerCatalogHeaderProps) {
    return <KhorneDashboardHeader className={className} isAllTasksOpen onAllTasks={noop} onBack={onBack ?? noop} allTasksButtonRef={emptyButtonRef}/>;
}

export function KhorneDashboardHeader({className, isAllTasksOpen, onAllTasks, onBack, allTasksButtonRef}: KhorneDashboardHeaderProps) {
    const {tasks, catalogError, selectedTask, selectPreviousTask, selectNextTask} = useTaskContext();
    const hasTasks = tasks.length > 0;
    const title = selectedTask
        ? selectedTask.title
        : catalogError
            ? 'Tasks unavailable.'
            : hasTasks
                ? 'No task selected.'
                : 'Loading tasks…';

    return <div className={`${styles.dashboardShell} ${className ?? ''}`}>
        {isAllTasksOpen ? <KhorneCatalogueHeader onBack={onBack}/> : <UnifiedTaskHeader
            taskNumber={selectedTask?.ordinal}
            title={title}
            onPrevious={selectPreviousTask}
            onNext={selectNextTask}
            onBack={onAllTasks}
            navigationDisabled={!hasTasks}
            backButtonRef={allTasksButtonRef}
            showRail={false}
        />}
        <SlicedArtwork name="beam.png" cap={.075} className={`${taskHeaderStyles.beam} ${taskHeaderStyles.metal} ${styles.catalogueRail}`} khorneRail/>
    </div>;
}

export default function KhorneHeader({className, mode, onAllTasks, onBack, allTasksButtonRef}: KhorneHeaderProps) {
    return <KhorneDashboardHeader
        className={className}
        isAllTasksOpen={mode === 'catalogue'}
        onAllTasks={onAllTasks ?? noop}
        onBack={onBack ?? noop}
        allTasksButtonRef={allTasksButtonRef ?? emptyButtonRef}
    />;
}
