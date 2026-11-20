import styles from './Header.module.css';
import HeaderTaskListContainer from '@/app/_components/tasks/Browser TSX Components/header/HeaderTaskListContainer';
import type {RefObject} from 'react';
import {useCatTasksTheme} from '../taskDashboard/CatTasksTheme';
import KhorneHeader from './KhorneHeader';

interface TDHeaderProps {
    readonly className?: string;
    readonly onShowAllTasks?: () => void;
    readonly allTasksButtonRef?: RefObject<HTMLButtonElement | null>;
}

export default function Header({className, onShowAllTasks, allTasksButtonRef}: TDHeaderProps) {
    const {theme} = useCatTasksTheme();

    if (theme === 'khorne') {
        return <KhorneHeader className={className} mode="task" onAllTasks={onShowAllTasks} allTasksButtonRef={allTasksButtonRef}/>;
    }

    return (
        <div className={`${styles.headerContainer} ${styles.legacyHeader} ${className ?? ''}`} data-legacy-header="">
            {onShowAllTasks && (
                <button
                    ref={allTasksButtonRef}
                    type="button"
                    className={styles.allTasksButton}
                    onClick={onShowAllTasks}
                >
                    All tasks
                </button>
            )}
            <HeaderTaskListContainer className={styles.headerTaskContainer}/>
        </div>
    )
}
