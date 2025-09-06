import {AnimatedSprite, Spritesheet, Texture} from 'pixi.js';
import {type AnimationNameMap, type EntityAnimationState, setAnimation} from '../systems/animation';
import type {IUpdatable} from './IUpdatable';

export enum Direction {
    Left = -1,
    Right = 1,
}

export interface ActorOptions {
    asset: Spritesheet;
    animations: Record<string | number, Texture[]>;
    initialState: EntityAnimationState;
    nameMap: AnimationNameMap;
    direction?: Direction;
    alignToBottom?: boolean;
}

export class Actor implements IUpdatable {
    readonly view: AnimatedSprite;

    private asset: Spritesheet;
    private animations: Record<string | number, Texture[]>;
    private nameMap?: AnimationNameMap;
    private baseScaleX: number;

    constructor(options: ActorOptions) {
        this.asset = options.asset;
        this.animations = options.animations;
        this.nameMap = options.nameMap;
        this._state = options.initialState ?? 'Idle';
        this._direction = options.direction ?? Direction.Right;

        this.view = new AnimatedSprite(this.asset.animations[this._state]);

        if (options.alignToBottom) {
            this.view.anchor.set(0.5, 1);
        } else {
            this.view.anchor.set(0.5, 0.5);
        }
        this.baseScaleX = this.view.scale.x || 1;
        this.applyDirection();
        this.applyState();
    }

    private _state: EntityAnimationState;

    get state(): EntityAnimationState { return this._state; }

    private _direction: Direction;

    get direction(): Direction { return this._direction; }

    setState(next: EntityAnimationState) {
        if (this._state === next) return;
        this._state = next;
        this.applyState();
    }

    setDirection(dir: Direction) {
        if (this._direction === dir) return;
        this._direction = dir;
        this.applyDirection();
    }

    setPosition(x: number, y: number) {
        this.view.position.set(x, y);
    }

    centerInScene(sceneWidth: number, sceneHeight: number) {
        this.view.position.set(sceneWidth / 2, sceneHeight);
    }

    update(_delta: number) {}

    private applyState() {
        setAnimation(this.view, this.animations, this._state, {nameMap: this.nameMap});
    }

    private applyDirection() {
        this.view.scale.x = this.baseScaleX * (this._direction === Direction.Left ? -1 : 1);
    }
}