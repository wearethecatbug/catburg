import type {Actor} from '@/app/_components/tasks/feature/pixi/scene/Actor';

export interface IController {
    readonly priority: number;

    init(actor: Actor): void;

    update(delta: number): void;

    destroy(): void;
}

