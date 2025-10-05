import {MovementController} from './MovementController';
import {KeyboardController} from '../interactive/KeyboardController';
import {Direction} from '../scene/Actor';
import {GameEvent} from '../core/Event';

export class PlayerController extends MovementController {
    private keyboardController: KeyboardController;
    private isActive: boolean = true;

    constructor(keyboardController: KeyboardController, priority: number = 50) {
        super(priority);
        this.keyboardController = keyboardController;
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
        const up = this.keyboardController.isKeyPressed('ArrowUp') ||
                   this.keyboardController.isKeyPressed('W');
        const down = this.keyboardController.isKeyPressed('ArrowDown') ||
                     this.keyboardController.isKeyPressed('S');

        let horizontal = 0;
        let vertical = 0;

        if (left && !right) {
            horizontal = Direction.Left;
        } else if (right && !left) {
            horizontal = Direction.Right;
        }

        if (up && !down) {
            vertical = -1;
        } else if (down && !up) {
            vertical = 1;
        }

        if (horizontal !== 0 || vertical !== 0) {
            this.move(horizontal as Direction, vertical);
            this.emitEvent('player:moving', { horizontal, vertical });
        } else {
            this.stop();
            this.emitEvent('player:idle');
        }
    }

    destroy(): void {
        this.isActive = false;
        super.destroy();
    }
}

