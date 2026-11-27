import {AnimatedSprite, type Texture} from 'pixi.js';
import {ActorFactory} from '../factories/ActorFactory';
import type {IController} from '../controllers/IController';
import {Direction, type Actor} from '../scene/Actor';
import {ActorView} from '../views/ActorView';

export type TyranidAnimation = 'idle' | 'running' | 'eating' | 'acid' | 'sleeping';
export type TyranidSnapshot = {position: number; groundY: number; direction: 'left' | 'right'; state: TyranidAnimation; reducedMotion: boolean; stateStartedAt: number | null};

const animations: Record<TyranidAnimation, {frames: readonly number[]; durations: readonly number[]; reduced: number}> = {
    idle: {frames: [0, 1, 2, 1, 0, 6, 7, 8, 10, 11], durations: [260, 260, 260, 260, 260, 260, 260, 260, 260, 260], reduced: 0},
    running: {frames: [12, 13, 14, 15, 16, 17], durations: [100, 100, 100, 100, 100, 100], reduced: 12},
    eating: {frames: [18, 19, 20, 21, 22, 23], durations: [160, 160, 220, 180, 180, 180], reduced: 20},
    acid: {frames: [24, 25, 26, 27, 28, 29], durations: [100, 110, 150, 120, 120, 140], reduced: 26},
    sleeping: {frames: [36, 37, 36, 41], durations: [900, 700, 900, 700], reduced: 36},
};

class TyranidProjectionController implements IController {
    readonly priority = 10;
    private actor: Actor | null = null;
    private snapshot: TyranidSnapshot;
    private state: TyranidAnimation;
    private elapsed = 0;
    private cursor = 0;

    constructor(initial: TyranidSnapshot) { this.snapshot = initial; this.state = initial.state; }
    init(actor: Actor): void { this.actor = actor; }
    setSnapshot(snapshot: TyranidSnapshot): void { this.snapshot = snapshot; }
    update(delta: number): void {
        const actor = this.actor;
        if (!actor) return;
        actor.setPosition(this.snapshot.position, this.snapshot.groundY);
        actor.setDirection(this.snapshot.direction === 'left' ? Direction.Left : Direction.Right);
        const sprite = actor.view.sprite;
        const animation = animations[this.snapshot.state];
        if (this.state !== this.snapshot.state) { this.state = this.snapshot.state; this.elapsed = 0; this.cursor = 0; }
        if (this.snapshot.reducedMotion) { sprite.gotoAndStop(animation.reduced); return; }
        if ((this.snapshot.state === 'eating' || this.snapshot.state === 'acid') && this.snapshot.stateStartedAt !== null) {
            let elapsed = Math.max(0, performance.now() - this.snapshot.stateStartedAt);
            let cursor = 0;
            while (cursor < animation.durations.length - 1 && elapsed >= animation.durations[cursor]) {
                elapsed -= animation.durations[cursor];
                cursor += 1;
            }
            this.elapsed = elapsed;
            this.cursor = cursor;
            sprite.gotoAndStop(animation.frames[cursor]);
            return;
        }
        this.elapsed += Math.max(0, Math.min(delta, 50));
        while (this.elapsed >= animation.durations[this.cursor]) {
            this.elapsed -= animation.durations[this.cursor];
            this.cursor = (this.cursor + 1) % animation.frames.length;
        }
        sprite.gotoAndStop(animation.frames[this.cursor]);
    }
    destroy(): void { this.actor = null; }
}

export class TyranidActor {
    readonly actor: Actor;
    private readonly controller: TyranidProjectionController;

    constructor(textures: Texture[], initial: TyranidSnapshot) {
        const sprite = new AnimatedSprite({textures, autoPlay: false, autoUpdate: false, updateAnchor: true});
        sprite.gotoAndStop(0);
        const view = new ActorView(sprite, {Idle: textures});
        view.setScale(.43, .43);
        this.actor = ActorFactory.createActorFromView({view, initialPosition: {x: initial.position, y: initial.groundY}});
        this.controller = new TyranidProjectionController(initial);
        this.actor.addController('tyranid-projection', this.controller);
    }
    update(snapshot: TyranidSnapshot, delta: number): void { this.controller.setSnapshot(snapshot); this.actor.update(delta); }
    destroy(): void { this.actor.destroy(); }
}
