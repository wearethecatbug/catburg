import {IController} from './IController';
import {MovementModel} from '../models/MovementModel';
import {ActorModel} from '../models/ActorModel';
import {Direction} from '../scene/Actor';
import {GameEvent} from '../core/Event';
import {PlayerEvents} from '../core/EventTypes';
import type {Actor} from '../scene/Actor';

export class MovementController implements IController {
    readonly priority: number;

    private actorModel?: ActorModel;
    private movementModel?: MovementModel;
    private sceneBounds?: { width: number; height: number };

    constructor(priority: number = 100) {
        this.priority = priority;
    }

    init(actor: Actor): void {
        this.actorModel = actor.model;
        this.movementModel = this.actorModel?.getModel(MovementModel);

        if (!this.actorModel) {
            throw new Error('MovementController requires ActorModel');
        }
        if (!this.movementModel) {
            throw new Error('MovementController requires MovementModel in actor.model');
        }
    }

    setSceneBounds(width: number, height: number): void {
        this.sceneBounds = { width, height };
    }

    move(direction: Direction): void {
        if (!this.movementModel) return;

        const speed = this.movementModel.speed;
        const velocityX = direction * speed;

        this.movementModel.setVelocity(velocityX, 0);

        if (this.actorModel) {
            this.actorModel.setDirection(direction);
        }

        this.emitEvent(PlayerEvents.MOVING, { horizontal: direction });
    }

    stop(): void {
        if (!this.movementModel) return;
        this.movementModel.stop();
        this.emitEvent(PlayerEvents.IDLE);
    }

    update(delta: number): void {
        if (!this.actorModel || !this.movementModel) return;

        const velocity = this.movementModel.velocity;
        if (velocity.x === 0) return;

        const deltaSeconds = delta / 1000;
        const currentPos = this.actorModel.position;

        let newX = currentPos.x + velocity.x * deltaSeconds;

        if (this.sceneBounds) {
            newX = Math.max(0, Math.min(this.sceneBounds.width, newX));
        }

        this.actorModel.setPosition(newX, currentPos.y);
    }

    destroy(): void {
        this.actorModel = undefined;
        this.movementModel = undefined;
        this.sceneBounds = undefined;
    }

    protected emitEvent(type: string, data?: any): void {
        if (!this.actorModel) return;
        this.actorModel.dispatchEvent(new GameEvent(type, data));
    }
}

