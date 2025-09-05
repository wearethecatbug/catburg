'use client';
import {useEffect, useRef} from 'react';
import type {AnimatedSprite, Application} from 'pixi.js';
import styles from './HealthBarOverlay.module.css';

type HealthBarOverlayProps = {
    isReady: boolean;
    isSpriteReady: boolean;
    followEnabled: boolean;
    applicationRef: React.RefObject<Application | null>;
    spriteRef: React.RefObject<AnimatedSprite | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    maximumHealthPoints: number;
    currentHealthPoints: number;
    warningThresholdPercent?: number;  // NEW: жёлтый, по умолчанию 50%
    criticalThresholdPercent?: number; // NEW: красный, по умолчанию 25%
    verticalOffsetPixels?: number;   // по умолчанию 14
    totalWidthPixels?: number;        // по умолчанию 120
    totalHeightPixels?: number;       // по умолчанию 12
};

export default function HealthBarOverlay(props: HealthBarOverlayProps) {
    const {
        followEnabled,
        isReady,
        isSpriteReady,
        applicationRef,
        spriteRef,
        containerRef,
        maximumHealthPoints = 100,
        currentHealthPoints,
        warningThresholdPercent = 50,
        criticalThresholdPercent = 25,
        verticalOffsetPixels = 14,
        totalWidthPixels = 120,
        totalHeightPixels = 12,
    } = props;

    const healthBarRootElementRef = useRef<HTMLDivElement | null>(null);
    const healthBarFillElementRef = useRef<HTMLDivElement | null>(null);
    const verticalOffsetRef = useRef<number>(verticalOffsetPixels);
    const rootRef = healthBarRootElementRef;

    useEffect(() => {
        verticalOffsetRef.current = verticalOffsetPixels;
    }, [verticalOffsetPixels])

    // обновить заполнение по здоровью
    useEffect(() => {
        const fill = healthBarFillElementRef.current;
        if (!fill) return;
        const rootElement = rootRef.current;
        if (!rootElement) return;
        const clamped = Math.max(0, Math.min(currentHealthPoints, maximumHealthPoints));
        const fraction = maximumHealthPoints > 0 ? clamped / maximumHealthPoints : 0;

        fill.style.width = `${Math.round(fraction * 100)}%`;

        // цвет по порогам
        const warningFraction = Math.max(0, Math.min(100, warningThresholdPercent)) / 100;
        const criticalFraction = Math.max(0, Math.min(100, criticalThresholdPercent)) / 100;

        let color = '#35c759';           // зелёный
        if (fraction <= criticalFraction) color = '#ff3b30';     // красный
        else if (fraction <= warningFraction) color = '#ffcc00'; // жёлтый

        rootElement.style.setProperty('--hp-bar-color', color);
    }, [currentHealthPoints, maximumHealthPoints, warningThresholdPercent, criticalThresholdPercent]);


    const updatePosition = () => {
        const root = healthBarRootElementRef.current;
        const sprite = spriteRef.current;
        const application = applicationRef.current;
        const container = containerRef.current;
        if (!root || !sprite || !application || !container) return;

        const res = application.renderer.resolution;
        const bounds = sprite.getBounds();

        // сначала конвертируем world → CSS px
        const centerXCss = Math.round((bounds.x + bounds.width / 2) / res);
        const topCss = Math.round(bounds.y / res) - verticalOffsetRef.current;

        const barWidth = totalWidthPixels;
        const barHeight = totalHeightPixels;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        let left = centerXCss - Math.round(barWidth / 2);
        let top = topCss;

        // кламп внутри контейнера
        left = Math.max(0, Math.min(left, containerWidth - barWidth));
        top = Math.max(0, Math.min(top, containerHeight - barHeight));

        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
    };

    useEffect(() => {
        if (!isReady || !isSpriteReady) return;
        const application = applicationRef.current;
        const container = containerRef.current;
        if (!application || !container) return;

        const followCallback = () => {

            updatePosition();
        };
        application.ticker.add(followCallback);
        updatePosition(); // стартовая позиция

        return () => {
            application.ticker.remove(followCallback);
        };
    }, [isReady, isSpriteReady]);

    useEffect(() => {
        if (isReady && isSpriteReady && followEnabled) updatePosition();
    }, [followEnabled, isReady, isSpriteReady, totalWidthPixels, totalHeightPixels, applicationRef, spriteRef, containerRef]);


    return (
        <div
            ref={healthBarRootElementRef}
            className={styles.healthBarRoot}
            style={
                {
                    ['--hp-bar-width' as any]: `${totalWidthPixels}px`,
                    ['--hp-bar-height' as any]: `${totalHeightPixels}px`,
                    ['--hp-bar-radius' as any]: `${Math.min(6, totalHeightPixels / 2)}px`,
                } as React.CSSProperties
            }
        >
            <div ref={healthBarFillElementRef} className={styles.healthBarFill}/>
        </div>
    );
}