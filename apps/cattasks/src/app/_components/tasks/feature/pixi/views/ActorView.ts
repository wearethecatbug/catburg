import {AnimatedSprite, Texture} from 'pixi.js';
import {Direction} from '@/app/_components/tasks/feature/pixi/scene/Actor';
import {
    type AnimationNameMap,
    type EntityAnimationState,
    setAnimation
} from '@/app/_components/tasks/feature/pixi/systems/animation';

export interface AnimationConfig {
    fps?: number;
    loop?: boolean;
}

export class ActorView {
    readonly sprite: AnimatedSprite;

    private animations: Record<string | number, Texture[]>;
    private nameMap?: AnimationNameMap;
    private baseScaleX: number;
    private currentDirection: Direction;
    private animationConfigs: Map<EntityAnimationState, AnimationConfig> = new Map();

    constructor(
        sprite: AnimatedSprite,
        animations: Record<string | number, Texture[]>,
        nameMap?: AnimationNameMap
    ) {
        this.sprite = sprite;
        this.animations = animations;
        this.nameMap = nameMap;
        this.baseScaleX = sprite.scale.x || 1;
        this.currentDirection = this.baseScaleX >= 0 ? Direction.Right : Direction.Left;
    }

    setAnimationConfig(state: EntityAnimationState, config: AnimationConfig): void {
        this.animationConfigs.set(state, config);
    }

    setPosition(x: number, y: number): void {
        this.sprite.position.set(x, y);
    }

    getPosition(): { x: number; y: number } {
        return {
            x: this.sprite.x,
            y: this.sprite.y,
        };
    }

    setDirection(direction: Direction): void {
        if (this.currentDirection === direction) return;
        this.currentDirection = direction;
        this.sprite.scale.x = this.baseScaleX * (direction === Direction.Left ? -1 : 1);
    }

    setState(state: EntityAnimationState): void {
        setAnimation(this.sprite, this.animations, state, {nameMap: this.nameMap});

        const config = this.animationConfigs.get(state);
        if (config) {
            if (config.fps !== undefined) {
                this.sprite.animationSpeed = config.fps / 60;
            }
            if (config.loop !== undefined) {
                this.sprite.loop = config.loop;
            }
        }

        this.sprite.play();
    }

    setScale(x: number, y: number): void {
        const directionSign = this.currentDirection === Direction.Left ? -1 : 1;
        this.baseScaleX = Math.abs(x);
        this.sprite.scale.set(this.baseScaleX * directionSign, y);
    }

    setAlpha(alpha: number): void {
        this.sprite.alpha = Math.max(0, Math.min(1, alpha));
    }

    setVisible(visible: boolean): void {
        this.sprite.visible = visible;
    }

    destroy(): void {
        this.sprite.destroy();
    }
}

