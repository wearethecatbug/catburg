import {Model} from '../core/Model';
import {Direction} from '../scene/Actor';
import type {EntityAnimationState} from '../systems/animation';
import {StateEvents} from '../core/EventTypes';

export interface Vector2D {
    x: number;
    y: number;
}

export interface ActorModelConfig {
    position?: Vector2D;
    direction?: Direction;
    state?: EntityAnimationState;
}

export class ActorModel extends Model {
    private _position: Vector2D;
    private _direction: Direction;
    private _state: EntityAnimationState;

    constructor(config: ActorModelConfig = {}) {
        super();
        this._position = config.position ?? { x: 0, y: 0 };
        this._direction = config.direction ?? Direction.Right;
        this._state = config.state ?? 'Idle';
    }

    get position(): Readonly<Vector2D> {
        return this._position;
    }

    setPosition(x: number, y: number): void {
        if (this._position.x === x && this._position.y === y) return;
        this._position = { x, y };
        this.emitChange(StateEvents.POSITION_CHANGED, { x, y });
    }

    get direction(): Direction {
        return this._direction;
    }

    setDirection(direction: Direction): void {
        if (this._direction === direction) return;
        this._direction = direction;
        this.emitChange(StateEvents.DIRECTION_CHANGED, direction);
    }

    get state(): EntityAnimationState {
        return this._state;
    }

    setState(state: EntityAnimationState): void {
        if (this._state === state) return;
        const previousState = this._state;
        this._state = state;
        this.emitChange(StateEvents.STATE_CHANGED, { state, previousState });
    }
}

