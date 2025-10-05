import {EventDispatcher} from './EventDispatcher';
import {GameEvent} from './Event';

export abstract class Model extends EventDispatcher {
    private subModels: Map<string, Model> = new Map();

    addModel(name: string, model: Model): void {
        if (this.subModels.has(name)) {
            throw new Error(`Model with name '${name}' already exists`);
        }
        this.subModels.set(name, model);
    }

    removeModel(name: string): void {
        const model = this.subModels.get(name);
        if (model) {
            model.destroy();
            this.subModels.delete(name);
        }
    }

    getModel<T extends Model>(name: string): T | undefined {
        return this.subModels.get(name) as T | undefined;
    }

    hasModel(name: string): boolean {
        return this.subModels.has(name);
    }

    protected emitChange<T = any>(type: string, data?: T): void {
        this.dispatchEvent(new GameEvent(type, data));
    }

    destroy(): void {
        this.subModels.forEach(model => model.destroy());
        this.subModels.clear();
        this.removeAllListeners();
    }
}

