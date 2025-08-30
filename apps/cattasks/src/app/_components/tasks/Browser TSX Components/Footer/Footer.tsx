'use client';
import styles from './Footer.module.css';
import dynamic from 'next/dynamic';
//
// interface FooterProps {
//     readonly className?: string;
//     // readonly children?: React.ReactNode;
// }

// Динамический импорт компонентов с отключением SSR
const Doggy = dynamic(() => import('@/app/_components/tasks/Features/Doggy'), {ssr: false});
const FooterMonster = dynamic(() => import('@/app/_components/tasks/Features/FooterMonster'), {ssr: false});

export default function Footer() {
    return (
        <div className={styles.footerContainer}>
            <Doggy></Doggy>
            <FooterMonster></FooterMonster>
        </div>
    )
}