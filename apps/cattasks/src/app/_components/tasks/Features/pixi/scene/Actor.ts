import {AnimatedSprite, Spritesheet, Texture} from 'pixi.js';
import {type AnimationNameMap, type EntityAnimationState} from '../systems/animation';
import type {IUpdatable} from './IUpdatable';
import {ActorView} from '../views/ActorView';
import {ActorModel} from '../models/ActorModel';
import {IController} from '../controllers/IController';
import {GameEvent} from '../core/Event';

export enum Direction {
    Left = -1,
    Right = 1,
}

export interface ActorOptions {
    asset: Spritesheet;
    animations: Record<string | number, Texture[]>;
    initialState: EntityAnimationState;
    nameMap: AnimationNameMap;
    direction?: Direction;
    alignToBottom?: boolean;
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

    constructor(view: ActorView, model: ActorModel);
    constructor(options: ActorOptions);
    constructor(viewOrOptions: ActorView | ActorOptions, model?: ActorModel) {
        if (viewOrOptions instanceof ActorView) {
            this.view = viewOrOptions;
            this.model = model!;

            this.view.setPosition(this.model.position.x, this.model.position.y);
            this.view.setDirection(this.model.direction);
            this.view.setState(this.model.state);
        } else {
            const options = viewOrOptions;
            const sprite = new AnimatedSprite(options.asset.animations[options.initialState]);

            if (options.alignToBottom) {
                sprite.anchor.set(0.5, 1);
            } else {
                sprite.anchor.set(0.5, 0.5);
            }

            this.view = new ActorView(sprite, options.animations, options.nameMap);
            this.model = new ActorModel({
                position: { x: sprite.x, y: sprite.y },
                direction: options.direction ?? Direction.Right,
                state: options.initialState ?? 'Idle',
            });

            this.view.setDirection(this.model.direction);
            this.view.setState(this.model.state);
        }

        this.setupModelListeners();
    }

    private setupModelListeners(): void {
        this.model.addEventListener('position:changed', (event: GameEvent<{x: number; y: number}>) => {
            this.view.setPosition(event.data.x, event.data.y);
        });

        this.model.addEventListener('direction:changed', (event: GameEvent<Direction>) => {
            this.view.setDirection(event.data);
        });

        this.model.addEventListener('state:changed', (event: GameEvent<{state: EntityAnimationState}>) => {
            this.view.setState(event.data.state);
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
    }

    destroy(): void {
        this.controllers.forEach(entry => entry.controller.destroy());
        this.controllers.clear();
        this.sortedControllers = [];
        this.model.destroy();
        this.view.destroy();
    }
}