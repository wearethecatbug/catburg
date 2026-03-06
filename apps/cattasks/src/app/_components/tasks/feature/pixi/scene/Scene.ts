import {Container, Ticker} from 'pixi.js';
import type {IUpdatable} from './IUpdatable';
import {Actor} from './Actor';

export class Scene implements IUpdatable {
    readonly view: Container;
    private actors: Set<Actor> = new Set();
    private ticker?: Ticker;
    private started = false;
    private boundTick: (ticker: Ticker) => void;

    constructor(sceneViewContainer: Container) {
        this.view = sceneViewContainer;
        this.boundTick = (t) => this.update(t.deltaMS);
    }

    addActor(actor: Actor) {
        if (this.actors.has(actor)) return;
        this.actors.add(actor);
        this.view.addChild(actor.view.sprite);
    }

    removeActor(actor: Actor) {
        if (!this.actors.has(actor)) return;
        this.actors.delete(actor);
        if (actor.view.sprite.parent === this.view) {
            this.view.removeChild(actor.view.sprite);
        }
    }

    clear() {
        this.actors.forEach(a => {
            if (a.view.sprite.parent === this.view) this.view.removeChild(a.view.sprite);
        });
        this.actors.clear();
    }

    start(ticker: Ticker) {
        if (this.started) return;
        this.ticker = ticker;
        ticker.add(this.boundTick);
        this.started = true;
    }

    stop() {
        if (!this.started || !this.ticker) return;
        this.ticker.remove(this.boundTick);
        this.started = false;
    }

    destroy() {
        this.stop();
        this.clear();
    }

    update(delta: number) {
        // propagate to actors
        this.actors.forEach(actor => actor.update(delta));
    }
}