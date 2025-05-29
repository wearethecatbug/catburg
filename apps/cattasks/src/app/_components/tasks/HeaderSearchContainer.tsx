import styles from './HeaderSearchContainer.module.css';
import HeaderSearchInput from "@/app/_components/tasks/HeaderSearchInput";


interface HeaderSearchContainerProps {
    readonly className?: string;
    readonly children?: React.ReactNode;
}

export default function HeaderSearchContainer({className, children}: HeaderSearchContainerProps) {
    return (
        <div className={styles.searchContainer + ' ' + (className ?? '')}>
            <button className={styles.searchIcon}></button>
            <HeaderSearchInput className={styles.searchInput}/>
        </div>
    )
}