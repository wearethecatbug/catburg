import {Model} from '../core/Model';
import {MovementEvents, PlayerEvents} from '../core/EventTypes';

export interface PhysicsModelConfig {
    gravity?: number;
    jumpForce?: number;
}

export class PhysicsModel extends Model {
    private _gravity: number;
    private _jumpForce: number;
    private _isGrounded: boolean = true;
    private _verticalVelocity: number = 0;

    constructor(config: PhysicsModelConfig = {}) {
        super();
        this._gravity = config.gravity ?? 980;
        this._jumpForce = config.jumpForce ?? -400;
    }

    get gravity(): number {
        return this._gravity;
    }

    get jumpForce(): number {
        return this._jumpForce;
    }

    get isGrounded(): boolean {
        return this._isGrounded;
    }

    get verticalVelocity(): number {
        return this._verticalVelocity;
    }

    setGrounded(grounded: boolean): void {
        if (this._isGrounded === grounded) return;
        this._isGrounded = grounded;
        this.emitChange(MovementEvents.LANDED, { isGrounded: grounded });
    }

    setVerticalVelocity(vy: number): void {
        if (this._verticalVelocity === vy) return;
        this._verticalVelocity = vy;
        this.emitChange(MovementEvents.VELOCITY_CHANGED, { vy });
    }

    jump(): void {
        if (!this._isGrounded) return;
        this._verticalVelocity = this._jumpForce;
        this._isGrounded = false;
        this.emitChange(PlayerEvents.JUMP);
    }
}

