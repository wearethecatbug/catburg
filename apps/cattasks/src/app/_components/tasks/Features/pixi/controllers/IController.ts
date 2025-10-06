import type {Actor} from '../scene/Actor';

export interface IController {
    readonly priority: number;

    init(actor: Actor): void;

    update(delta: number): void;

    destroy(): void;
}

