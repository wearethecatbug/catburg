import {Model} from '../core/Model';
import type {Vector2D} from './ActorModel';

export interface MovementModelConfig {
    speed?: number;
    maxSpeed?: number;
}

export class MovementModel extends Model {
    private _velocity: Vector2D = { x: 0, y: 0 };
    private _speed: number;
    private _maxSpeed: number;
    private _isMoving: boolean = false;

    constructor(config: MovementModelConfig = {}) {
        super();
        this._speed = config.speed ?? 100;
        this._maxSpeed = config.maxSpeed ?? 300;
    }

    get velocity(): Readonly<Vector2D> {
        return this._velocity;
    }

    setVelocity(x: number, y: number): void {
        const clampedX = Math.max(-this._maxSpeed, Math.min(this._maxSpeed, x));
        const clampedY = Math.max(-this._maxSpeed, Math.min(this._maxSpeed, y));

        if (this._velocity.x === clampedX && this._velocity.y === clampedY) return;

        this._velocity = { x: clampedX, y: clampedY };

        const wasMoving = this._isMoving;
        this._isMoving = clampedX !== 0 || clampedY !== 0;

        this.emitChange('velocity:changed', { x: clampedX, y: clampedY });

        if (wasMoving !== this._isMoving) {
            this.emitChange(this._isMoving ? 'movement:started' : 'movement:stopped', { isMoving: this._isMoving });
        }
    }

    get speed(): number {
        return this._speed;
    }

    setSpeed(speed: number): void {
        if (this._speed === speed) return;
        this._speed = Math.max(0, speed);
        this.emitChange('speed:changed', this._speed);
    }

    get maxSpeed(): number {
        return this._maxSpeed;
    }

    setMaxSpeed(maxSpeed: number): void {
        if (this._maxSpeed === maxSpeed) return;
        this._maxSpeed = Math.max(0, maxSpeed);
        this.emitChange('maxSpeed:changed', this._maxSpeed);
    }

    get isMoving(): boolean {
        return this._isMoving;
    }

    stop(): void {
        this.setVelocity(0, 0);
    }
}

