'use client';

import {AnimatedSprite, Assets, Spritesheet, Texture} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';
import styles from './FooterMonster.module.css';
import {onCollisionWithEntity} from './Collision';
import {usePixiApplication} from './pixi/hooks/usePixiApplication';
import {computeFrameBase, computeSpriteLayoutForBox} from './pixi/utils/layout';
import {spriteSheetPaths} from './pixi/assets/manifest';

export default function FooterMonster() {
    const {containerRef, applicationRef} = usePixiApplication();
    const spriteRef = useRef<AnimatedSprite | null>(null);

    const [animationTexturesMap, setAnimationTexturesMap] =
        useState<Record<string | number, Texture[]>>();
    const [currentAnimation, setCurrentAnimation] = useState<string>('Idle');

    const fitToFooter = () => {
        const spriteInstance = spriteRef.current;
        const containerElement = containerRef.current;
        if (!spriteInstance || !containerElement) return;

        const footerElement = containerElement.parentElement as HTMLElement | null;
        const availableWidth = Math.max(1, footerElement?.clientWidth ?? 1);
        const availableHeight = Math.max(1, footerElement?.clientHeight ?? 1);

        const base = computeFrameBase(spriteInstance);
        const layout = computeSpriteLayoutForBox(base, availableWidth, availableHeight, spriteInstance.scale.x);

        spriteInstance.scale.set(layout.scaleX, layout.scaleY);
        containerElement.style.width = `${layout.containerWidth}px`;
        containerElement.style.height = `${layout.containerHeight}px`;
        spriteInstance.anchor.set(0.5);
        spriteInstance.x = layout.containerWidth / 2;
        spriteInstance.y = layout.containerHeight / 2;
    };

    useEffect(() => {
        const application = applicationRef.current;
        const containerElement = containerRef.current;
        if (!application || !containerElement) return;

        let isMounted = true;
        let resizeObserver: ResizeObserver | null = null;
        let unsubscribeDoggyCollision: (() => void) | null = null;

        (async () => {
            const spritesheet = await Assets.load<Spritesheet>(spriteSheetPaths.monsterWorm);
            if (!isMounted) return;

            setAnimationTexturesMap(spritesheet.animations);

            const animatedSprite = new AnimatedSprite(spritesheet.animations[currentAnimation] ?? [], true);
            spriteRef.current = animatedSprite;

            animatedSprite.animationSpeed = 0.4;
            animatedSprite.loop = currentAnimation !== 'Attack';
            animatedSprite.eventMode = 'none';

            application.stage.addChild(animatedSprite);

            resizeObserver = new ResizeObserver(fitToFooter);
            resizeObserver.observe(containerElement);
            animatedSprite.onFrameChange = fitToFooter;
            fitToFooter();

            unsubscribeDoggyCollision = onCollisionWithEntity('doggy', application, animatedSprite, (isIntersecting) => {
                if (isIntersecting) setCurrentAnimation('Attack');
            });
        })();

        return () => {
            isMounted = false;

            if (resizeObserver) {
                try {
                    resizeObserver.disconnect();
                } catch {
                }
                resizeObserver = null;
            }

            if (unsubscribeDoggyCollision) {
                try {
                    unsubscribeDoggyCollision();
                } catch {
                }
                unsubscribeDoggyCollision = null;
            }

            spriteRef.current = null;
        };
    }, [applicationRef, containerRef, spriteSheetPaths.monsterWorm]);

    useEffect(() => {
        const spriteInstance = spriteRef.current;
        if (!spriteInstance || !animationTexturesMap) return;

        const nextTextures = animationTexturesMap[currentAnimation] ?? [];
        spriteInstance.loop = currentAnimation !== 'Attack';
        spriteInstance.onComplete =
            currentAnimation === 'Attack' ? () => setCurrentAnimation('Idle') : undefined;

        if (spriteInstance.textures !== nextTextures) {
            spriteInstance.textures = nextTextures;
            spriteInstance.gotoAndPlay(0);
        } else {
            spriteInstance.play();
        }
    }, [currentAnimation, animationTexturesMap]);

    return <div ref={containerRef} className={styles.monsterSprite} suppressHydrationWarning/>;
}