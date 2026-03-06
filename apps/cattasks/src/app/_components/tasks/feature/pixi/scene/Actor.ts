import {type EntityAnimationState} from '@/app/_components/tasks/feature/pixi/systems/animation';
import type {IUpdatable} from './IUpdatable';
import {ActorView} from '@/app/_components/tasks/feature/pixi/views/ActorView';
import {ActorModel} from '@/app/_components/tasks/feature/pixi/models/ActorModel';
import {IController} from '@/app/_components/tasks/feature/pixi/controllers/IController';
import {PlayerEvents} from '@/app/_components/tasks/feature/pixi/core/EventTypes';

export enum Direction {
    Left = -1,
    Right = 1,
}

interface ControllerEntry {
    controller: IController;
    priority: number;
}

export class Actor implements IUpdatable {
    readonly view: ActorView;
    readonly model: ActorModel;

    private controllers: Map<string, ControllerEntry> = new Map();
    private sortedControllers: IController[] = [];

    private lastSyncedPosition: { x: number, y: number };
    private lastSyncedDirection: Direction;
    private lastSyncedState: EntityAnimationState;

    constructor(view: ActorView, model: ActorModel) {
        this.view = view;
        this.model = model;

        this.lastSyncedPosition = {...this.model.position};
        this.lastSyncedDirection = this.model.direction;
        this.lastSyncedState = this.model.state;

        this.view.setPosition(this.model.position.x, this.model.position.y);
        this.view.setDirection(this.model.direction);
        this.view.setState(this.model.state);

        this.setupPlayerEventListeners();
    }

    private setupPlayerEventListeners(): void {
        this.model.addEventListener(PlayerEvents.MOVING, () => {
            if (this.model.state !== 'Walk') {
                this.model.setState('Walk');
            }
        });

        this.model.addEventListener(PlayerEvents.IDLE, () => {
            if (this.model.state !== 'Idle') {
                this.model.setState('Idle');
            }
        });
    }

    get state(): EntityAnimationState {
        return this.model.state;
    }

    get direction(): Direction {
        return this.model.direction;
    }

    setState(next: EntityAnimationState): void {
        this.model.setState(next);
    }

    setDirection(dir: Direction): void {
        this.model.setDirection(dir);
    }

    setPosition(x: number, y: number): void {
        this.model.setPosition(x, y);
    }

    centerInScene(sceneWidth: number, sceneHeight: number): void {
        this.setPosition(sceneWidth / 2, sceneHeight);
    }

    addController(name: string, controller: IController): void {
        if (this.controllers.has(name)) {
            throw new Error(`Controller with name '${name}' already exists`);
        }

        const entry: ControllerEntry = {
            controller,
            priority: controller.priority,
        };

        this.controllers.set(name, entry);
        controller.init(this);
        this.rebuildSortedControllers();
    }

    removeController(name: string): void {
        const entry = this.controllers.get(name);
        if (!entry) return;

        entry.controller.destroy();
        this.controllers.delete(name);
        this.rebuildSortedControllers();
    }

    getController<T extends IController>(name: string): T | undefined {
        return this.controllers.get(name)?.controller as T | undefined;
    }

    hasController(name: string): boolean {
        return this.controllers.has(name);
    }

    private rebuildSortedControllers(): void {
        this.sortedControllers = Array.from(this.controllers.values())
            .sort((a, b) => a.priority - b.priority)
            .map(entry => entry.controller);
    }

    update(delta: number): void {
        for (const controller of this.sortedControllers) {
            controller.update(delta);
        }

        this.syncModelToView();
    }

    private syncModelToView(): void {
        const pos = this.model.position;
        if (pos.x !== this.lastSyncedPosition.x || pos.y !== this.lastSyncedPosition.y) {
            this.view.setPosition(pos.x, pos.y);
            this.lastSyncedPosition = {...pos};
        }

        if (this.model.direction !== this.lastSyncedDirection) {
            this.view.setDirection(this.model.direction);
            this.lastSyncedDirection = this.model.direction;
        }

        if (this.model.state !== this.lastSyncedState) {
            this.view.setState(this.model.state);
            this.lastSyncedState = this.model.state;
        }
    }

    destroy(): void {
        this.controllers.forEach(entry => entry.controller.destroy());
        this.controllers.clear();
        this.sortedControllers = [];
        this.model.destroy();
        this.view.destroy();
    }
}