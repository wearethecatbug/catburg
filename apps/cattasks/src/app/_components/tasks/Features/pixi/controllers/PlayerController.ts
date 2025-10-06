import {MovementController} from './MovementController';
import {KeyboardController} from '../interactive/KeyboardController';
import {Direction} from '../scene/Actor';
import type {Actor} from '../scene/Actor';
import {PhysicsModel} from '../models/PhysicsModel';

export class PlayerController extends MovementController {
    private keyboardController: KeyboardController;
    private isActive: boolean = true;
    private actorRef?: Actor;

    constructor(keyboardController: KeyboardController, priority: number = 50) {
        super(priority);
        this.keyboardController = keyboardController;
    }

    init(actor: Actor): void {
        super.init(actor);
        this.actorRef = actor;
    }

    setActive(active: boolean): void {
        this.isActive = active;
        if (!active) {
            this.stop();
        }
    }

    update(delta: number): void {
        if (!this.isActive) {
            super.update(delta);
            return;
        }

        this.handleInput();
        super.update(delta);
    }

    private handleInput(): void {
        const left = this.keyboardController.isKeyPressed('ArrowLeft') ||
                     this.keyboardController.isKeyPressed('A');
        const right = this.keyboardController.isKeyPressed('ArrowRight') ||
                      this.keyboardController.isKeyPressed('D');
        const jump = this.keyboardController.isKeyPressed('Space') ||
                     this.keyboardController.isKeyPressed('ArrowUp') ||
                     this.keyboardController.isKeyPressed('W');

        let horizontal = 0;

        if (left && !right) {
            horizontal = Direction.Left;
        } else if (right && !left) {
            horizontal = Direction.Right;
        }

        const physicsModel = this.actorRef?.model.getModel(PhysicsModel);
        if (jump && physicsModel?.isGrounded) {
            physicsModel.jump();
        }

        if (horizontal !== 0) {
            this.move(horizontal as Direction);
        } else {
            this.stop();
        }
    }

    destroy(): void {
        this.isActive = false;
        super.destroy();
    }
}

