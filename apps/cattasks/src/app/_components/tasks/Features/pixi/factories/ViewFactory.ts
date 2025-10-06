import {AnimatedSprite, Spritesheet, Texture} from 'pixi.js';
import {ActorView, AnimationConfig} from '../views/ActorView';
import {Direction} from '../scene/Actor';
import type {AnimationNameMap, EntityAnimationState} from '../systems/animation';

export interface ActorViewConfig {
    spritesheet: Spritesheet;
    animations: Record<string | number, Texture[]>;
    nameMap?: AnimationNameMap;
    initialState?: EntityAnimationState;
    direction?: Direction;
    alignToBottom?: boolean;
    anchorX?: number;
    anchorY?: number;
    animationConfigs?: Partial<Record<EntityAnimationState, AnimationConfig>>;
}

export class ViewFactory {
    static createActorView(config: ActorViewConfig): ActorView {
        const {
            spritesheet,
            animations,
            nameMap,
            initialState = 'Idle',
            direction = Direction.Right,
            alignToBottom = false,
            anchorX,
            anchorY,
            animationConfigs,
        } = config;

        const sprite = new AnimatedSprite(spritesheet.animations[initialState]);

        if (anchorX !== undefined && anchorY !== undefined) {
            sprite.anchor.set(anchorX, anchorY);
        } else if (alignToBottom) {
            sprite.anchor.set(0.5, 1);
        } else {
            sprite.anchor.set(0.5, 0.5);
        }

        const view = new ActorView(sprite, animations, nameMap);

        if (animationConfigs) {
            for (const [state, config] of Object.entries(animationConfigs)) {
                view.setAnimationConfig(state as EntityAnimationState, config);
            }
        }

        view.setDirection(direction);
        view.setState(initialState);

        return view;
    }
}

