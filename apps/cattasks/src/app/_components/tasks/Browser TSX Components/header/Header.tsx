import styles from './Header.module.css';
import HeaderTaskListContainer from '@/app/_components/tasks/Browser TSX Components/header/HeaderTaskListContainer';

interface TDHeaderProps {
    readonly className?: string;
}

export default function Header({className}: TDHeaderProps) {
    return (
        <div className={`${styles.headerContainer} ${className ?? ''}`}>
            <HeaderTaskListContainer className={styles.headerTaskContainer}/>
            {/*<div className={styles.headerBtnContainer}>*/}
            {/*<HeaderBtnRunCode className={styles.headerBtnRunCode}/>*/}
            {/*<HeaderBtnTest className={styles.headerBtnTest}/>*/}
            {/*<HeaderBtnInfo className={styles.headerBtnInfo}>*/}
            {/*    <div className={styles.headerBtnTestErrorText}/>*/}
            {/*</HeaderBtnInfo>*/}
            {/*<HeaderBtnSolution className={styles.headerBtnSolution}/>*/}
            {/*</div>*/}
        </div>
    )
}