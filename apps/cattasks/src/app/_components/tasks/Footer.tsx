import styles from './Footer.module.css';
import Doggy from '@/app/_components/tasks/Doggy';
import FooterMonster from '@/app/_components/tasks/FooterMonster';

interface FooterProps {
    readonly className?: string;
}

export default function Footer({className}: FooterProps) {
    return (
        <div className={`${styles.footerContainer} ${className ?? ''}`}>
            <Doggy />
            <FooterMonster />
        </div>
    );
}