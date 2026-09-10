import type {AnimatedSprite, Application} from 'pixi.js';
import type {MutableRefObject} from 'react';
import {clampSpritePosition} from './bounds';

export type ViewportBounds = {
    left: number; right: number; top: number; bottom: number; width: number; height: number;
};

export type MovementSystem = { dispose: () => void };

export type MovementSystemOptions<TAnimation extends string = string> = {
    movementSpeedPixelsPerTick?: number;
    getViewportBounds: () => ViewportBounds;
    setCurrentAnimationIfChanged: (animationName: TAnimation) => void;
    idleState: TAnimation;
    walkState: TAnimation;
};

export function initHorizontalKeyboardMovement<TAnimation extends string = string>(
    application: Application,
    spriteRef: MutableRefObject<AnimatedSprite | null>,
    options: MovementSystemOptions<TAnimation>
): MovementSystem {
    const {
        movementSpeedPixelsPerTick = 3,
        getViewportBounds,
        setCurrentAnimationIfChanged,
        idleState,
        walkState
    } = options;

    const keyboard = {left: false, right: false};
    let currentlyPressedKey: 'left' | 'right' | null = null;
    let numberOfFramesSinceKeyDown = 0;

    const acceleration = 0.22;
    let velocity = 0;
    let movementDirectionSign = 1;

    const setFacingByKey = (key: 'left' | 'right') => {
        const sprite = spriteRef.current;
        if (!sprite) return;
        const absoluteScaleX = Math.abs(sprite.scale.x) || 1;
        const directionSign = key === 'left' ? -1 : 1;
        sprite.scale.set(directionSign * absoluteScaleX, sprite.scale.y);
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.code !== 'ArrowLeft' && event.code !== 'KeyA' &&
            event.code !== 'ArrowRight' && event.code !== 'KeyD') return;
        event.preventDefault();

        const key = event.code === 'ArrowLeft' || event.code === 'KeyA' ? 'left' : 'right';

        if (key == 'right')
            movementDirectionSign = 1;
        else
            movementDirectionSign = -1;

        if (key == 'left' || key == 'right')
            options.setCurrentAnimationIfChanged(options.walkState); // тап — в Walk

        if (currentlyPressedKey !== key) {
            currentlyPressedKey = key;
            velocity = 0;
            numberOfFramesSinceKeyDown = 0;
            setFacingByKey(key);
            //options.setCurrentAnimationIfChanged(options.idleState); // тап — остаёмся в Idle
        }
    };

    const onKeyUp = (event: KeyboardEvent) => {
        if (event.code !== 'ArrowLeft' && event.code !== 'KeyA' &&
            event.code !== 'ArrowRight' && event.code !== 'KeyD') return;
        const key = event.code === 'ArrowLeft' || event.code === 'KeyA' ? 'left' : 'right';
        if (currentlyPressedKey === key) {
            currentlyPressedKey = null;
            options.setCurrentAnimationIfChanged(options.idleState);
        }
    };


    const onTick = () => {
        const sprite = spriteRef.current;
        if (!sprite) return;
        if (currentlyPressedKey) {
            velocity += acceleration;
            // velocity = 0;
        }

        const viewportBounds = options.getViewportBounds();
        // всегда держим “ноги” на земле
        sprite.y = viewportBounds.bottom;

        //if (!currentlyPressedKey) return;

        // первый кадр после нажатия — только разворот, без движения
        if (numberOfFramesSinceKeyDown === 0) {
            numberOfFramesSinceKeyDown = 1;
            //return;
        }

        velocity *= 0.95; // трение

        // удержание — идём
        const movementSpeedPixelsPerTick = options.movementSpeedPixelsPerTick ?? 10;

        sprite.x += movementDirectionSign * velocity;

        clampSpritePosition(sprite, viewportBounds);
    };

    application.ticker.add(onTick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return {
        dispose: () => {
            application.ticker.remove(onTick);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        },
    };
}
