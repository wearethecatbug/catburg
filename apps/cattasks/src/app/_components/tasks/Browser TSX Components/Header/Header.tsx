import styles from './Header.module.css';
import HeaderTaskListContainer from '@/app/_components/tasks/Browser TSX Components/Header/HeaderTaskListContainer';
import HeaderBtnSolution from "@/app/_components/tasks/Browser TSX Components/Header/HeaderBtnSolution";
import HeaderBtnTest from "@/app/_components/tasks/Browser TSX Components/Header/HeaderBtnTest";

interface TDHeaderProps {
    readonly className?: string;
}

export default function Header({className}: TDHeaderProps) {
    return (
        <div className={`${styles.headerContainer} ${className ?? ''}`}>
            <HeaderTaskListContainer className={styles.headerTaskContainer}/>
            <HeaderBtnTest className={styles.headerBtnTest}/>
            <HeaderBtnSolution className={styles.headerBtnSolution}/>
        </div>
    )
}