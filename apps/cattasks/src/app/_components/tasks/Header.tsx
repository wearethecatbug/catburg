import styles from './Header.module.css';
import HeaderTaskListContainer from "@/app/_components/tasks/HeaderTaskListContainer";
import HeaderSearchContainer from "@/app/_components/tasks/HeaderSearchContainer";


interface TDHeaderProps {
    readonly className?: string;
}

export default function Header({className}: TDHeaderProps) {
    return (
        <div className={`${styles.headerContainer} ${className ?? ''}`}>
            <HeaderSearchContainer className={styles.searchContainer}/>
            <HeaderTaskListContainer className={styles.taskListContainer}/>
        </div>
    )
}