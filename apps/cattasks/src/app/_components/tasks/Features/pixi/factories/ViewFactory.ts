import {AnimatedSprite, Spritesheet, Texture} from 'pixi.js';
import {ActorView} from '../views/ActorView';
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

        view.setDirection(direction);
        view.setState(initialState);

        return view;
    }
}

