import styles from './Header.module.css';
import HeaderTaskListContainer from "./HeaderSearchContainer";
import HeaderSearchContainer from "./HeaderTaskListContainer";


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