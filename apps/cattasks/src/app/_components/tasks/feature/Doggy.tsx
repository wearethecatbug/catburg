'use client';

import {AnimatedSprite, Assets, Spritesheet, Texture,} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';
import styles from './Doggy.module.css';

import {startHitboxEmitter} from '@/app/_components/tasks/feature/pixi/systems/collision';
import {spriteSheetPaths} from '@/app/_components/tasks/feature/pixi/assets/manifest';
import {usePixiApplication} from '@/app/_components/tasks/feature/pixi/hooks/usePixiApplication';
import {useViewportBounds} from '@/app/_components/tasks/feature/pixi/hooks/useViewportBounds';
import {clampSpritePosition} from '@/app/_components/tasks/feature/pixi/systems/bounds';
import type {MovementSystem} from '@/app/_components/tasks/feature/pixi/systems/movement';
import {initHorizontalKeyboardMovement} from '@/app/_components/tasks/feature/pixi/systems/movement';
import {EntityAnimationState, setAnimation} from '@/app/_components/tasks/feature/pixi/systems/animation';
import {DOG_ANIMATION_NAME_MAP} from "@/app/_components/tasks/feature/pixi/entities/doggy/animations";
import {applyBottomLeftLayoutToSprite} from '@/app/_components/tasks/feature/pixi/utils/layout';
import HealthBarOverlay from '@/app/_components/tasks/feature/pixi/ui/HealthBarOverlay';

interface DoggyDebugWindow extends Window {
    __setDoggyHealthPoints?: (value: number) => void;
}

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
    const [isSpriteReady, setIsSpriteReady] = useState(false);

    const followEnabled = currentAnimation === 'Walk';

    const [currentHealthPoints, setCurrentHealthPoints] = useState<number>(100);
    const maximumHealthPoints = 100;

    const setCurrentAnimationIfChanged = (animationName: EntityAnimationState) => {
        setCurrentAnimation(previous => (previous === animationName ? previous : animationName));
    };

    function spawnDoggyAtStartOfFooterWindow() {
        const animatedSprite = spriteRef.current;
        if (!animatedSprite) return;

        // якорь и стороны задаёт твой лэйаут
        applyBottomLeftLayoutToSprite(animatedSprite, viewportBoundsRef.current);
        clampSpritePosition(animatedSprite, viewportBoundsRef.current);

        // сразу обновить позицию HP-бара
        // updateHealthBarDomPositionFromSpriteBounds(animatedSprite);
    }


    // Инициализация спрайта, движения и полоски здоровья
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
            // призываем собаку у начала футер-окна


            const initialAnimationName = DOG_ANIMATION_NAME_MAP?.[currentAnimation] ?? currentAnimation;

            let initialTextures = spritesheet.animations[initialAnimationName] ?? [];
            if (initialTextures.length === 0) {
                console.warn(`[Doggy] Missing "${initialAnimationName}", using first available.`);
                initialTextures = Object.values(spritesheet.animations)[0] ?? [];
                if (initialTextures.length === 0) throw new Error('Spritesheet: empty initial animation');
            }

            const animatedSprite = new AnimatedSprite(initialTextures, true);
            spriteRef.current = animatedSprite;
            animatedSprite.animationSpeed = 0.2;
            animatedSprite.loop = currentAnimation !== 'Attack';
            animatedSprite.eventMode = 'none';

            application.stage.addChild(animatedSprite);
            setIsSpriteReady(true);
            spawnDoggyAtStartOfFooterWindow();

            // немедленно назначаем и запускаем текущую анимацию
            setAnimation(animatedSprite, spritesheet.animations, currentAnimation, {
                nameMap: DOG_ANIMATION_NAME_MAP,
                nextStateAfterComplete: state => (state === 'Attack' ? 'Idle' : undefined),
            });

            movementSystem = initHorizontalKeyboardMovement<EntityAnimationState>(application, spriteRef, {
                movementSpeedPixelsPerTick: 3,
                getViewportBounds: () => viewportBoundsRef.current,
                setCurrentAnimationIfChanged,
                idleState: 'Idle',
                walkState: 'Walk',
            });

            unsubscribeHitbox = startHitboxEmitter('doggy', application, animatedSprite);
        })();
        // тестовый глобальный сеттер (по желанию удалите)
        const debugWindow = window as DoggyDebugWindow;
        debugWindow.__setDoggyHealthPoints = (value: number) => setCurrentHealthPoints(value);

        return () => {
            isMounted = false;
            setIsSpriteReady(false);
            delete debugWindow.__setDoggyHealthPoints;

            if (movementSystem) {
                try {
                    movementSystem.dispose();
                } catch {
                    // A partially initialized movement system may already be disposed.
                }
                movementSystem = null;
            }

            if (unsubscribeHitbox) {
                try {
                    unsubscribeHitbox();
                } catch {
                    // Hitbox cleanup is best-effort after asynchronous initialization.
                }
                unsubscribeHitbox = null;
            }

            if (spriteRef.current && application) {
                try {
                    application.stage.removeChild(spriteRef.current);
                } catch {
                    // The sprite may already have been removed by Pixi teardown.
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

        setAnimation(sprite, map, currentAnimation, {
            nameMap: DOG_ANIMATION_NAME_MAP,
            nextStateAfterComplete: s => (s === 'Attack' ? 'Idle' : undefined),
        });
    }, [currentAnimation]);

    // При изменении размеров вьюпорта, позиционируем спрайт заново
    useEffect(() => {
        const application = applicationRef.current;
        const sprite = spriteRef.current;
        if (!application || !sprite) return;
        spawnDoggyAtStartOfFooterWindow();
    }, [viewportBounds]);

    return (
        <div ref={containerRef} className={styles.doggySprite} suppressHydrationWarning>
            <HealthBarOverlay
                followEnabled={followEnabled}
                isReady={isReady}
                isSpriteReady={isSpriteReady}
                applicationRef={applicationRef}
                spriteRef={spriteRef}
                containerRef={containerRef}
                maximumHealthPoints={maximumHealthPoints}
                currentHealthPoints={currentHealthPoints}
                warningThresholdPercent={50}   // <=50% жёлтый
                criticalThresholdPercent={25}  // <=25% красный
                verticalOffsetPixels={21}
                totalWidthPixels={70}
                totalHeightPixels={8}
            />
        </div>
    );
}
