export interface IController {
    readonly priority: number;

    init(actor: any): void;

    update(delta: number): void;

    destroy(): void;
}

