'use client';

import {forwardRef} from 'react';
import type {CSSProperties} from 'react';
import styles from './CollapsedTaskSpine.module.css';

export type CollapsedTaskSpineProps = {
    readonly controlsId: string;
    readonly onExpand: () => void;
    readonly label?: string;
    readonly className?: string;
    readonly assetBasePath?: string;
    readonly desktopImageName?: string;
    readonly mobileImageName?: string;
    readonly disabled?: boolean;
};

type SpineImageVariables = CSSProperties & {
    '--task-spine-desktop-image': string;
    '--task-spine-mobile-image': string;
};

/** Renders only while the task description is collapsed. */
const CollapsedTaskSpine = forwardRef<HTMLButtonElement, CollapsedTaskSpineProps>(function CollapsedTaskSpine({
    controlsId,
    onExpand,
    label = 'Show task',
    className,
    assetBasePath = '/task-spine',
    desktopImageName = 'book-spine-desktop.png',
    mobileImageName = 'book-spine-mobile.png',
    disabled = false,
}, ref) {
    const basePath = assetBasePath.replace(/\/+$/, '');
    const imageVariables: SpineImageVariables = {
        '--task-spine-desktop-image': `url(${JSON.stringify(`${basePath}/${desktopImageName}`)})`,
        '--task-spine-mobile-image': `url(${JSON.stringify(`${basePath}/${mobileImageName}`)})`,
    };

    return (
        <button
            ref={ref}
            type="button"
            className={className ? `${styles.spine} ${className}` : styles.spine}
            style={imageVariables}
            aria-controls={controlsId}
            aria-expanded={false}
            aria-label={label}
            onClick={onExpand}
            disabled={disabled}
        >
            <span className={styles.label}>{label}</span>
            <svg
                className={styles.chevron}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
            >
                <path d="M8 4L16 12L8 20"/>
            </svg>
        </button>
    );
});

CollapsedTaskSpine.displayName = 'CollapsedTaskSpine';

export default CollapsedTaskSpine;
