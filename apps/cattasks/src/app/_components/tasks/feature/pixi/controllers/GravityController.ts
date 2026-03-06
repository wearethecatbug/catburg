import {IController} from './IController';
import {PhysicsModel} from '@/app/_components/tasks/feature/pixi/models/PhysicsModel';
import {ActorModel} from '@/app/_components/tasks/feature/pixi/models/ActorModel';
import type {Actor} from '@/app/_components/tasks/feature/pixi/scene/Actor';

export class GravityController implements IController {
    readonly priority: number = 90;

    private actorModel?: ActorModel;
    private physicsModel?: PhysicsModel;
    private groundY: number = 0;

    constructor(groundY: number) {
        this.groundY = groundY;
    }

    init(actor: Actor): void {
        this.actorModel = actor.model;
        this.physicsModel = this.actorModel.getModel(PhysicsModel);

        if (!this.actorModel) {
            throw new Error('GravityController requires ActorModel');
        }
        if (!this.physicsModel) {
            throw new Error('GravityController requires PhysicsModel');
        }
    }

    update(delta: number): void {
        if (!this.actorModel || !this.physicsModel) return;

        const deltaSeconds = delta / 1000;
        const currentPos = this.actorModel.position;

        let vy = this.physicsModel.verticalVelocity;
        vy += this.physicsModel.gravity * deltaSeconds;

        let newY = currentPos.y + vy * deltaSeconds;

        if (newY >= this.groundY) {
            newY = this.groundY;
            vy = 0;
            this.physicsModel.setGrounded(true);
        } else {
            this.physicsModel.setGrounded(false);
        }

        this.physicsModel.setVerticalVelocity(vy);
        this.actorModel.setPosition(currentPos.x, newY);
    }

    destroy(): void {
        this.actorModel = undefined;
        this.physicsModel = undefined;
    }
}

