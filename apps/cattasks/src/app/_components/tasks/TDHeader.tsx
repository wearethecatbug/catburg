import styles from './TDHeader.module.css';
import { ReactNode } from 'react';
import TDHeaderTaskList from './TDHeaderTaskList';

type TDHeaderProps = {
    children: ReactNode;
};

export default function TDHeader({ children }: TDHeaderProps) {
    return (
        <div className={styles.headerContainer}>
            <TDHeaderTaskList></TDHeaderTaskList>
        </div>
    )
}