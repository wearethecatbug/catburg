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
    const onDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') keyboard.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') keyboard.right = true;
    };
    const onUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') keyboard.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') keyboard.right = false;
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const onTick = () => {
        const sprite = spriteRef.current;
        if (!sprite) return;

        const bounds = getViewportBounds();
        let deltaX = 0;
        if (keyboard.left) deltaX -= movementSpeedPixelsPerTick;
        if (keyboard.right) deltaX += movementSpeedPixelsPerTick;

        if (deltaX !== 0) {
            const sign = deltaX < 0 ? -1 : 1;
            sprite.scale.set(sign * Math.abs(sprite.scale.x), Math.abs(sprite.scale.y));
            setCurrentAnimationIfChanged(walkState);
        } else {
            setCurrentAnimationIfChanged(idleState);
        }

        sprite.x += deltaX;
        clampSpritePosition(sprite, bounds);
        sprite.y = bounds.bottom - sprite.height;
    };

    application.ticker.add(onTick);

    return {
        dispose: () => {
            application.ticker.remove(onTick);
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
        },
    };
}