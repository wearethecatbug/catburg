'use client';

import {useLayoutEffect, useRef, type CSSProperties, type RefObject} from 'react';
import {ASSET_MAP} from './unifiedTaskHeaderAssets';
import styles from './UnifiedTaskHeader.module.css';

export type WarhammerHeaderTheme = 'khorne' | 'nurgle';

export const warhammerAquilaSrc: Readonly<Record<WarhammerHeaderTheme, string>> = {
    khorne: '/cattasks/themes/khorne/task-header/aquila-ruby.png',
    nurgle: '/cattasks/themes/nurgle/aquila.png',
};

type ArtworkProps = {
    readonly name: keyof typeof ASSET_MAP;
    readonly className?: string;
    readonly bounds?: readonly [number, number, number, number];
    readonly khorneVent?: boolean;
};

export function Artwork({name, className, bounds, khorneVent = false}: ArtworkProps) {
    const source = ASSET_MAP[name];
    const [left, top, right, bottom] = bounds ?? source.bounds;
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const imageStyle: CSSProperties = {
        width: `${(source.width / width) * 100}%`,
        height: `${(source.height / height) * 100}%`,
        left: `${(-left / width) * 100}%`,
        top: `${(-top / height) * 100}%`,
    };

    const directory = 'directory' in source ? source.directory : 'shared/task-header';

    return <span className={`${styles.artwork} ${className ?? ''}`} data-cattasks-decoration="" data-khorne-vent={khorneVent ? '' : undefined} aria-hidden="true"><img src={`/cattasks/themes/${directory}/${name}`} alt="" draggable={false} style={imageStyle}/></span>;
}

type SlicedArtworkProps = Pick<ArtworkProps, 'name' | 'className'> & {
    readonly cap?: number;
    readonly khorneRail?: boolean;
    readonly theme?: WarhammerHeaderTheme;
};

export function SlicedArtwork({name, className, cap = .12, khorneRail = false, theme}: SlicedArtworkProps) {
    const [left, top, right, bottom] = ASSET_MAP[name].bounds;
    const cut = (right - left) * cap;
    // beam.png has its rivets baked in, so stretch a clean section between them.
    const railCenter: readonly [number, number, number, number] = [left + 182, top, left + 222, bottom];
    const center: readonly [number, number, number, number] = khorneRail && name === 'beam.png'
        ? railCenter
        : [left + cut, top, right - cut, bottom];
    const slices: Array<readonly [number, number, number, number]> = [
        [left, top, left + cut, bottom],
        center,
        [right - cut, top, right, bottom],
    ];
    const style = {'--art-cap-ratio': cut / Math.max(1, bottom - top)} as CSSProperties;

    return <span className={`${styles.sliced} ${className ?? ''}`} data-cattasks-decoration="" data-khorne-rail={khorneRail ? '' : undefined} data-warhammer-variant={theme} style={style} aria-hidden="true">{slices.map((bounds, index) => <Artwork key={index} name={name} bounds={bounds}/>)}</span>;
}

function Arrow({direction}: {readonly direction: 'left' | 'right'}) {
    return <svg className={styles.arrow} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={direction === 'left' ? 'M14.5 5.5 8 12l6.5 6.5' : 'm9.5 5.5 6.5 6.5-6.5 6.5'} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ChamberDivider() {
    return <svg className={styles.divider} viewBox="0 0 8 100" preserveAspectRatio="none" fill="none" aria-hidden="true"><path className={styles.dividerShadow} d="M7 0 1 100" strokeWidth="2.4"/><path className={styles.dividerEdge} d="M6 0 0 100" strokeWidth="1.2"/></svg>;
}

type UnifiedTaskHeaderProps = {
    readonly className?: string;
    readonly taskNumber?: number;
    readonly title: string;
    readonly onPrevious: () => void;
    readonly onNext: () => void;
    readonly onBack?: () => void;
    readonly previousDisabled: boolean;
    readonly nextDisabled: boolean;
    readonly backButtonRef?: RefObject<HTMLButtonElement | null>;
    readonly showRail?: boolean;
    readonly theme?: WarhammerHeaderTheme;
};

export default function UnifiedTaskHeader({className, taskNumber, title, onPrevious, onNext, onBack, previousDisabled, nextDisabled, backButtonRef, showRail = true, theme = 'khorne'}: UnifiedTaskHeaderProps) {
    const titleRef = useRef<HTMLHeadingElement>(null);
    const titleCopyRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const heading = titleRef.current;
        const copy = titleCopyRef.current;
        if (!heading || !copy) return;

        let frame = 0;
        let lastInlineSize = 0;
        let disposed = false;
        const minimumFontSize = 18;

        const fitTitle = () => {
            if (disposed) return;
            heading.style.removeProperty('--header-title-fitted-size');
            delete heading.dataset.titleTruncated;

            const style = getComputedStyle(heading);
            const preferredFontSize = Math.max(minimumFontSize, Number.parseFloat(style.fontSize));
            const fitsInTwoLines = () => {
                const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);
                return Number.isFinite(lineHeight) && heading.scrollHeight <= lineHeight * 2 + 1;
            };

            if (fitsInTwoLines()) return;

            for (let size = preferredFontSize - .5; size >= minimumFontSize; size -= .5) {
                heading.style.setProperty('--header-title-fitted-size', `${size}px`);
                if (fitsInTwoLines()) return;
            }

            heading.style.setProperty('--header-title-fitted-size', `${minimumFontSize}px`);
            heading.dataset.titleTruncated = 'true';
        };
        const scheduleFit = () => {
            if (disposed) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(fitTitle);
        };
        const observer = new ResizeObserver(([entry]) => {
            const inlineSize = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
            if (Math.abs(inlineSize - lastInlineSize) < .5) return;
            lastInlineSize = inlineSize;
            scheduleFit();
        });

        observer.observe(copy);
        lastInlineSize = copy.getBoundingClientRect().width;
        fitTitle();
        void document.fonts?.ready.then(() => {
            if (!disposed) scheduleFit();
        });

        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [title]);

    return (
        <header className={`${styles.viewport} ${className ?? ''}`} data-khorne-header="task" data-warhammer-variant={theme}>
            <div className={styles.header}>
                <div className={styles.railSurface} aria-hidden="true"/>
                <div className={`${styles.vent} ${styles.ventLeft}`} aria-hidden="true"><Artwork name="vent-frame.png" className={styles.metal}/><span className={`${styles.ventInsert} ${styles.accent}`} data-khorne-vent="" data-warhammer-variant={theme}/></div>
                <div className={`${styles.vent} ${styles.ventRight}`} aria-hidden="true"><Artwork name="vent-frame.png" className={styles.metal}/><span className={`${styles.ventInsert} ${styles.accent}`} data-khorne-vent="" data-warhammer-variant={theme}/></div>
                <Artwork name="vent-frame.png" bounds={[1700, 164, 2110, 543]} className={`${styles.titleShoulder} ${styles.titleShoulderLeft} ${styles.metal}`}/>
                <Artwork name="vent-frame.png" bounds={[1700, 164, 2110, 543]} className={`${styles.titleShoulder} ${styles.titleShoulderRight} ${styles.metal}`}/>
                <Artwork name="right-armor-cap.png" className={`${styles.armorCap} ${styles.metal}`}/>
                {onBack && <><SlicedArtwork name="back-button-mount.png" cap={.2} className={`${styles.backMount} ${styles.metal}`}/><button ref={backButtonRef} className={`${styles.button} ${styles.back}`} type="button" onClick={onBack}><span className={styles.buttonSurface} aria-hidden="true"/><SlicedArtwork name="back-button-housing.png" cap={.2} className={`${styles.buttonFrame} ${styles.metal}`}/><span className={styles.buttonContent}><span aria-hidden="true">←</span>All tasks</span></button></>}
                <div className={styles.plaque}>
                    <div className={styles.plaqueSurface} aria-hidden="true"/>
                    <SlicedArtwork name="title-frame.png" className={`${styles.titleFrame} ${styles.metal}`}/>
                    <div className={styles.main}>
                        <button className={`${styles.button} ${styles.nav} ${styles.navLeft}`} type="button" onClick={onPrevious} disabled={previousDisabled} aria-disabled={previousDisabled} aria-label="Select previous task"><span className={styles.navFace} aria-hidden="true"/><ChamberDivider/><span className={styles.buttonContent}><Arrow direction="left"/></span></button>
                        <div ref={titleCopyRef} className={styles.copy}><span className={styles.number}>{taskNumber === undefined ? '' : `TASK ${String(taskNumber).padStart(2, '0')}`}</span><h1 ref={titleRef} className={styles.name} data-long={title.length > 24 ? 'true' : undefined} title={title}>{title}</h1></div>
                        <button className={`${styles.button} ${styles.nav} ${styles.navRight}`} type="button" onClick={onNext} disabled={nextDisabled} aria-disabled={nextDisabled} aria-label="Select next task"><span className={styles.navFace} aria-hidden="true"/><ChamberDivider/><span className={styles.buttonContent}><Arrow direction="right"/></span></button>
                    </div>
                </div>
                <span className={styles.crest} data-khorne-aquila="" data-warhammer-variant={theme} aria-hidden="true"><img src={warhammerAquilaSrc[theme]} alt="" draggable={false}/></span>
                {showRail && <SlicedArtwork name="beam.png" cap={.075} className={`${styles.beam} ${styles.metal}`} khorneRail theme={theme}/>}
            </div>
        </header>
    );
}
