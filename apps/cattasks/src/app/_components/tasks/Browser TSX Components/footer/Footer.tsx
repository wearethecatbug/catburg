'use client';
import styles from './Footer.module.css';
import dynamic from 'next/dynamic';

interface FooterProps {
    readonly className?: string;
    // readonly children?: React.ReactNode;
}

// Динамический импорт компонентов с отключением SSR
const Doggy = dynamic(() => import('@/app/_components/tasks/feature/Doggy'), {ssr: false});
const WormMonster = dynamic(() => import('@/app/_components/tasks/feature/WormMonster'), {ssr: false});

export default function Footer({className}: FooterProps) {
    return (
        <div className={styles.footerContainer}>
            <Doggy></Doggy>
            <WormMonster></WormMonster>
        </div>
    )
}