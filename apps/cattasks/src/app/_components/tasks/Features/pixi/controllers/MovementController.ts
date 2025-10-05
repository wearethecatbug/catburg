import {IController} from './IController';
import {MovementModel} from '../models/MovementModel';
import {ActorModel} from '../models/ActorModel';
import {Direction} from '../scene/Actor';
import {GameEvent} from '../core/Event';

export class MovementController implements IController {
    readonly priority: number;

    private actorModel?: ActorModel;
    private movementModel?: MovementModel;
    private sceneBounds?: { width: number; height: number };

    constructor(priority: number = 100) {
        this.priority = priority;
    }

    init(actor: any): void {
        this.actorModel = actor.model as ActorModel;
        this.movementModel = this.actorModel?.getModel<MovementModel>('movement');

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

    move(direction: Direction, vertical: number = 0): void {
        if (!this.movementModel) return;

        const speed = this.movementModel.speed;
        const velocityX = direction * speed;
        const velocityY = vertical * speed;

        this.movementModel.setVelocity(velocityX, velocityY);

        if (this.actorModel && velocityX !== 0) {
            this.actorModel.setDirection(direction);
        }
    }

    stop(): void {
        if (!this.movementModel) return;
        this.movementModel.stop();
    }

    update(delta: number): void {
        if (!this.actorModel || !this.movementModel) return;

        const velocity = this.movementModel.velocity;
        if (velocity.x === 0 && velocity.y === 0) return;

        const deltaSeconds = delta / 1000;
        const currentPos = this.actorModel.position;

        let newX = currentPos.x + velocity.x * deltaSeconds;
        let newY = currentPos.y + velocity.y * deltaSeconds;

        if (this.sceneBounds) {
            newX = Math.max(0, Math.min(this.sceneBounds.width, newX));
            newY = Math.max(0, Math.min(this.sceneBounds.height, newY));
        }

        this.actorModel.setPosition(newX, newY);
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

