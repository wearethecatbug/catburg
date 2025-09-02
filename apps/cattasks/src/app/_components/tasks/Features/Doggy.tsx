'use client';

import {AnimatedSprite, Assets, Spritesheet, Texture} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';
import styles from './Doggy.module.css';

import {startHitboxEmitter} from './pixi/systems/collision';
import {applyBottomLeftLayoutToSprite} from './pixi/utils/layout';
import {spriteSheetPaths} from './pixi/assets/manifest';
import {usePixiApplication} from './pixi/hooks/usePixiApplication';
import {useViewportBounds} from './pixi/hooks/useViewportBounds';
import {clampSpritePosition} from './pixi/systems/bounds';
import type {MovementSystem} from './pixi/systems/movement';
import {initHorizontalKeyboardMovement} from './pixi/systems/movement';
import {EntityAnimationState, setAnimation} from './pixi/systems/animation';
import {DOG_ANIMATION_NAME_MAP} from "@/app/_components/tasks/Features/pixi/entities/doggy/animations";

export default function Doggy() {
    const {containerRef, applicationRef, isReady} = usePixiApplication();

    const {viewportBounds} = useViewportBounds(8, containerRef);
    const viewportBoundsRef = useRef(viewportBounds);
    useEffect(() => {
        viewportBoundsRef.current = viewportBounds;
    }, [viewportBounds]);

    const spriteRef = useRef<AnimatedSprite | null>(null);
    const animationTexturesMapRef = useRef<Record<string | number, Texture[]> | null>(null);
    const [currentAnimation, setCurrentAnimation] =
        useState<EntityAnimationState>('Idle');

    const setCurrentAnimationIfChanged = (animationName: EntityAnimationState) => {
        setCurrentAnimation(previous => (previous === animationName ? previous : animationName));
    };
    // Инициализация спрайта и систем при готовности приложения
    useEffect(() => {
        if (!isReady) return;
        const application = applicationRef.current;
        if (!application) return;

        let isMounted = true;
        let unsubscribeHitbox: (() => void) | null = null;
        let movementSystem: MovementSystem | null = null;


        (async () => {
            const spritesheet = await Assets.load<Spritesheet>(spriteSheetPaths.doggy);
            if (!isMounted) return;
            animationTexturesMapRef.current = spritesheet.animations;

            const initialAnimationName = DOG_ANIMATION_NAME_MAP?.[currentAnimation] ?? currentAnimation;

            let initialTextures = spritesheet.animations[initialAnimationName] ?? [];
            if (initialTextures.length === 0) {
                console.warn(`[WormMonster] Missing "${initialAnimationName}", using first available.`);
                initialTextures = Object.values(spritesheet.animations)[0] ?? [];
                if (initialTextures.length === 0) throw new Error('Spritesheet: empty initial animation');
            }

            const animatedSprite = new AnimatedSprite(initialTextures, true);
            spriteRef.current = animatedSprite;

            animatedSprite.animationSpeed = 0.2;
            animatedSprite.loop = currentAnimation !== 'Attack';
            animatedSprite.eventMode = 'none';

            application.stage.addChild(animatedSprite);

            movementSystem = initHorizontalKeyboardMovement<EntityAnimationState>(application, spriteRef, {
                movementSpeedPixelsPerTick: 13,
                getViewportBounds: () => viewportBoundsRef.current,
                setCurrentAnimationIfChanged,
                idleState: 'Idle',
                walkState: 'Walk',
            });

            applyBottomLeftLayoutToSprite(animatedSprite, viewportBounds);

            unsubscribeHitbox = startHitboxEmitter('doggy', application, animatedSprite);

        })();

        return () => {
            isMounted = false;

            if (movementSystem) {
                try {
                    movementSystem.dispose();
                } catch {
                }
                movementSystem = null;
            }

            if (unsubscribeHitbox) {
                try {
                    unsubscribeHitbox();
                } catch {
                }
                unsubscribeHitbox = null;
            }

            if (spriteRef.current && application) {
                try {
                    application.stage.removeChild(spriteRef.current);
                } catch {
                }
            }
            spriteRef.current = null;
        };
    }, [isReady]); // не зависим от viewportBounds и currentAnimation

    // При изменении анимации, меняем текстуры спрайта
    useEffect(() => {
        const sprite = spriteRef.current;
        const map = animationTexturesMapRef.current;
        if (!sprite || !map) return;

        setAnimation(sprite, map, currentAnimation as any, {
            nameMap: DOG_ANIMATION_NAME_MAP,
            nextStateAfterComplete: s => (s === 'Attack' ? 'Idle' : undefined),
        });
    }, [currentAnimation]);

    // При изменении размеров вьюпорта, позиционируем спрайт заново
    useEffect(() => {
        const application = applicationRef.current;
        const sprite = spriteRef.current;
        if (!application || !sprite) return;
        applyBottomLeftLayoutToSprite(sprite, viewportBoundsRef.current);
        clampSpritePosition(sprite, viewportBoundsRef.current);
    }, [viewportBounds]);

    return <div ref={containerRef} className={styles.doggySprite} suppressHydrationWarning/>;
}
