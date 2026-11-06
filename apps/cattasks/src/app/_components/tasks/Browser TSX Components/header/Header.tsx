import styles from './Header.module.css';
import HeaderTaskListContainer from '@/app/_components/tasks/Browser TSX Components/header/HeaderTaskListContainer';
import type {RefObject} from 'react';

interface TDHeaderProps {
    readonly className?: string;
    readonly onShowAllTasks?: () => void;
    readonly allTasksButtonRef?: RefObject<HTMLButtonElement | null>;
}

export default function Header({className, onShowAllTasks, allTasksButtonRef}: TDHeaderProps) {
    return (
        <div className={`${styles.headerContainer} ${className ?? ''}`}>
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
