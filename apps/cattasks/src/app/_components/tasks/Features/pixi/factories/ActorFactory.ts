import {Actor, Direction} from '../scene/Actor';
import {ActorModel} from '../models/ActorModel';
import {MovementModel} from '../models/MovementModel';
import {PhysicsModel} from '../models/PhysicsModel';
import {ViewFactory} from './ViewFactory';
import {PlayerController} from '../controllers/PlayerController';
import {MovementController} from '../controllers/MovementController';
import {GravityController} from '../controllers/GravityController';
import type {KeyboardController} from '../interactive/KeyboardController';
import {Assets, type Spritesheet} from 'pixi.js';
import type {AnimationNameMap, EntityAnimationState} from '../systems/animation';
import type {AnimationConfig} from '../views/ActorView';

export interface BaseActorConfig {
    spritesheet: string;
    nameMap: AnimationNameMap;
    initialPosition: { x: number; y: number };
    direction?: Direction;
    alignToBottom?: boolean;
    animationConfigs?: Partial<Record<EntityAnimationState, AnimationConfig>>;
}

export interface MobileActorConfig extends BaseActorConfig {
    speed: number;
    maxSpeed?: number;
}

export interface PlayerActorConfig extends MobileActorConfig {
    keyboardController: KeyboardController;
    sceneBounds: { width: number; height: number };
}

export class ActorFactory {
    static createStaticActor(config: BaseActorConfig): Actor {
        const spritesheet = Assets.get<Spritesheet>(config.spritesheet);

        if (!spritesheet) {
            throw new Error(`Spritesheet '${config.spritesheet}' not found in Assets`);
        }

        const view = ViewFactory.createActorView({
            spritesheet,
            animations: spritesheet.animations,
            nameMap: config.nameMap,
            initialState: 'Idle',
            direction: config.direction ?? Direction.Right,
            alignToBottom: config.alignToBottom ?? false,
            animationConfigs: config.animationConfigs,
        });

        const model = new ActorModel({
            position: config.initialPosition,
            direction: config.direction ?? Direction.Right,
            state: 'Idle',
        });

        const actor = new Actor(view, model);
        return actor;
    }

    static createMobileActor(config: MobileActorConfig): Actor {
        const actor = ActorFactory.createStaticActor(config);

        const movementModel = new MovementModel({
            speed: config.speed,
            maxSpeed: config.maxSpeed,
        });
        actor.model.addModel(movementModel);

        const movementController = new MovementController(100);
        actor.addController('movement', movementController);

        return actor;
    }

    static createPlayerActor(config: PlayerActorConfig): Actor {
        const actor = ActorFactory.createMobileActor(config);

        const physicsModel = new PhysicsModel();
        actor.model.addModel(physicsModel);

        const gravityController = new GravityController(config.initialPosition.y);
        actor.addController('gravity', gravityController);

        const playerController = new PlayerController(
            config.keyboardController,
            50
        );
        playerController.setSceneBounds(
            config.sceneBounds.width,
            config.sceneBounds.height
        );
        actor.addController('player', playerController);

        return actor;
    }
}

