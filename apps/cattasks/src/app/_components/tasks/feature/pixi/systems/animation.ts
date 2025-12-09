import type {AnimatedSprite, Texture} from 'pixi.js';

export type EntityAnimationState =
    | 'Idle' | 'Walk' | 'Attack' | 'Hurt' | 'Death';

export type AnimationNameMap = Partial<Record<EntityAnimationState, string>>;

type Options = {
    nameMap?: AnimationNameMap;
    nextStateAfterComplete?: (state: EntityAnimationState) => EntityAnimationState | undefined;
};

export function setAnimation(
    sprite: AnimatedSprite,
    animations: Record<string | number, Texture[]>,
    state: EntityAnimationState,
    options?: Options
) {
    const resolvedName = options?.nameMap?.[state] ?? state;
    const nextTextures = animations[resolvedName] ?? [];

    sprite.loop = options?.nextStateAfterComplete?.(state) === undefined;
    sprite.onComplete = () => {
        const next = options?.nextStateAfterComplete?.(state);
        if (!next) return;
        setAnimation(sprite, animations, next, options);
    };

    if (sprite.textures !== nextTextures) {
        sprite.textures = nextTextures;
        if (!nextTextures || nextTextures.length === 0) return; // тихо выходим или логируем warn
        sprite.gotoAndPlay(0);
    } else {
        sprite.play();
    }
}