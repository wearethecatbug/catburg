'use client';

import {AnimatedSprite, Assets, Spritesheet, Texture} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';
import styles from './WormMonster.module.css';
import {onCollisionWithEntity} from './pixi/systems/collision';
import {usePixiApplication} from './pixi/hooks/usePixiApplication';
import {applyCenterLayoutToSpriteInContainer} from './pixi/utils/layout';
import {spriteSheetPaths} from './pixi/assets/manifest';
import {EntityAnimationState} from './pixi/systems/animation';
import {WORM_ANIMATION_NAME_MAP} from './pixi/entities/wormMonster/animations';

export default function WormMonster() {
    const {containerRef, applicationRef} = usePixiApplication();

    const spriteRef = useRef<AnimatedSprite | null>(null);
    const animationTexturesMapRef = useRef<Record<string | number, Texture[]> | null>(null);

    const [currentAnimation, setCurrentAnimation] =
        useState<EntityAnimationState>('Idle');
    const currentAnimationRef = useRef<EntityAnimationState>('Idle');
    useEffect(() => {
        currentAnimationRef.current = currentAnimation;
    }, [currentAnimation]);


    const setCurrentAnimationIfChanged = (next: EntityAnimationState) =>
        setCurrentAnimation(prev => (prev === next ? prev : next));

    useEffect(() => {
        const application = applicationRef.current;
        const containerElement = containerRef.current;
        if (!application || !containerElement) return;

        let isMounted = true;
        let resizeObserver: ResizeObserver | null = null;
        let unsubscribeDoggyCollision: (() => void) | null = null;

        const fitToContainer = () => {
            const sprite = spriteRef.current;
            if (!sprite) return;
            const parentElement = containerElement.parentElement as HTMLElement | null;
            const availableWidth = Math.max(1, parentElement?.clientWidth ?? 1);
            const availableHeight = Math.max(1, parentElement?.clientHeight ?? 1);
            applyCenterLayoutToSpriteInContainer(sprite, containerElement, availableWidth, availableHeight);
        };

        (async () => {
            const spritesheet = await Assets.load<Spritesheet>(spriteSheetPaths.monsterWorm);
            if (!isMounted) return;

            animationTexturesMapRef.current = spritesheet.animations;
            const initialLogicalState = currentAnimation; // 'Idle' по умолчанию
            const initialAnimationName =
                WORM_ANIMATION_NAME_MAP?.[initialLogicalState] ?? initialLogicalState;

            let initialTextures = spritesheet.animations[initialAnimationName] ?? [];

            if (initialTextures.length === 0) {
                console.warn(`[WormMonster] Missing animation "${initialAnimationName}", using first available.`);
                initialTextures = Object.values(spritesheet.animations)[0] ?? [];
                if (initialTextures.length === 0) throw new Error('Spritesheet: empty initial animation');
            }

            const animatedSprite = new AnimatedSprite(initialTextures, true);
            spriteRef.current = animatedSprite;


            animatedSprite.animationSpeed = 0.1;
            animatedSprite.loop = currentAnimation !== 'Attack';
            animatedSprite.eventMode = 'none';

            application.stage.addChild(animatedSprite);

            resizeObserver = new ResizeObserver(fitToContainer);
            resizeObserver.observe(containerElement);
            animatedSprite.onFrameChange = fitToContainer;
            fitToContainer();

            unsubscribeDoggyCollision = onCollisionWithEntity(
                'doggy',
                application,
                animatedSprite,
                (isIntersecting) => {
                    if (isIntersecting && currentAnimation !== 'Attack') {
                        setCurrentAnimationIfChanged('Attack');
                    }
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

            const sprite = spriteRef.current;
            if (sprite) {
                try {
                    application.stage.removeChild(sprite);
                } catch {
                }
            }
            spriteRef.current = null;
        };
    }, [applicationRef, containerRef]);

    useEffect(() => {
        const sprite = spriteRef.current;
        const map = animationTexturesMapRef.current;
        if (!sprite || !map) return;


        const name = (WORM_ANIMATION_NAME_MAP?.[currentAnimation] ?? currentAnimation);
        const frames = map[name] ?? [];
        if (frames.length === 0) return;

        if (sprite.textures !== frames) {
            sprite.textures = frames;
            sprite.gotoAndPlay(0);
        } else {
            sprite.play();
        }

        sprite.loop = currentAnimation !== 'Attack';
        sprite.onComplete = currentAnimation === 'Attack'
            ? () => setCurrentAnimation('Idle')   // ВАЖНО: переводим ИМЕННО СТЕЙТ
            : undefined;
    }, [currentAnimation]);

    return <div ref={containerRef} className={styles.monsterSprite} suppressHydrationWarning/>;
}