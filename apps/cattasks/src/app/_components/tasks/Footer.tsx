import styles from './Footer.module.css';
import Doggy from '@/app/_components/tasks/Doggy';
import FooterMonster from '@/app/_components/tasks/FooterMonster';

interface FooterProps {
    readonly className?: string;
    readonly children?: React.ReactNode;
}

export default function Footer({className, children}: FooterProps) {
    return (
        <div className={styles.footerContainer}>
            <Doggy></Doggy>
            <FooterMonster></FooterMonster>
        </div>
    )
}