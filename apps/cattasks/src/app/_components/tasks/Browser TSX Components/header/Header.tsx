import styles from './Header.module.css';
import HeaderTaskListContainer from '@/app/_components/tasks/Browser TSX Components/header/HeaderTaskListContainer';

interface TDHeaderProps {
    readonly className?: string;
}

export default function Header({className}: TDHeaderProps) {
    return (
        <div className={`${styles.headerContainer} ${className ?? ''}`}>
            <HeaderTaskListContainer className={styles.headerTaskContainer}/>
        </div>
    )
}