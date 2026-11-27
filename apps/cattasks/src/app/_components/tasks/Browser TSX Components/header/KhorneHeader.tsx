'use client';

import type {RefObject} from 'react';
import {useTaskContext} from '../../context/TaskProvider';
import styles from './KhorneHeader.module.css';
import type {WarhammerTheme} from '../taskDashboard/CatTasksTheme';
import V146Header, {type V146Construction} from './v146/V146Header';

type KhorneDashboardHeaderProps = {
    readonly className?: string;
    readonly isAllTasksOpen: boolean;
    readonly onAllTasks: () => void;
    readonly onBack: () => void;
    readonly allTasksButtonRef: RefObject<HTMLButtonElement | null>;
    readonly theme?: WarhammerTheme;
    readonly construction?: V146Construction;
    readonly workspaceWidth?: number;
};

type KhorneHeaderProps = {
    readonly className?: string;
    readonly mode: 'task' | 'catalogue';
    readonly onAllTasks?: () => void;
    readonly onBack?: () => void;
    readonly allTasksButtonRef?: RefObject<HTMLButtonElement | null>;
    readonly theme?: WarhammerTheme;
    readonly construction?: V146Construction;
    readonly workspaceWidth?: number;
};

type WarhammerCatalogHeaderProps = {
    readonly className?: string;
    readonly onBack?: () => void;
    readonly theme?: WarhammerTheme;
};

const noop = () => undefined;
const emptyButtonRef: RefObject<HTMLButtonElement | null> = {current: null};

export function WarhammerCatalogHeader({className, onBack, theme = 'khorne'}: WarhammerCatalogHeaderProps) {
    return <KhorneDashboardHeader className={className} isAllTasksOpen onAllTasks={noop} onBack={onBack ?? noop} allTasksButtonRef={emptyButtonRef} theme={theme}/>;
}

export function KhorneDashboardHeader({className, isAllTasksOpen, onAllTasks, onBack, allTasksButtonRef, theme = 'khorne', construction = 'industrial', workspaceWidth = 320}: KhorneDashboardHeaderProps) {
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

    return <div className={`${styles.dashboardShell} ${isAllTasksOpen ? styles.catalogueDashboardShell : ''} ${className ?? ''}`} data-cattasks-v146-shell="" data-warhammer-variant={theme}>
        <V146Header width={workspaceWidth} construction={construction} theme={theme} mode={isAllTasksOpen ? 'catalogue' : 'task'} title={title} taskNumber={selectedTask?.ordinal} onBack={isAllTasksOpen ? onBack : onAllTasks} onPrevious={() => { if (!previousDisabled) selectPreviousTask(); }} onNext={() => { if (!nextDisabled) selectNextTask(); }} previousDisabled={previousDisabled} nextDisabled={nextDisabled} backButtonRef={allTasksButtonRef}/>
    </div>;
}

export default function KhorneHeader({className, mode, onAllTasks, onBack, allTasksButtonRef, theme = 'khorne', construction = 'industrial', workspaceWidth = 320}: KhorneHeaderProps) {
    return <KhorneDashboardHeader
        className={className}
        isAllTasksOpen={mode === 'catalogue'}
        onAllTasks={onAllTasks ?? noop}
        onBack={onBack ?? noop}
        allTasksButtonRef={allTasksButtonRef ?? emptyButtonRef}
        theme={theme}
        construction={construction}
        workspaceWidth={workspaceWidth}
    />;
}
