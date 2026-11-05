'use client';

import {combineClassNames} from '@/app/_components/tasks/shared/utils/combineClassNames';
import PetStrip from './PetStrip';
import styles from './Footer.module.css';

interface FooterProps {
    readonly className?: string;
}

export default function Footer({className}: FooterProps) {
    return (
        <footer className={combineClassNames(styles.footerContainer, className)}>
            <PetStrip/>
        </footer>
    );
}
