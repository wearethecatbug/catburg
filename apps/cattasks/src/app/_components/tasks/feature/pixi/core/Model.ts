import {EventDispatcher} from './EventDispatcher';
import {GameEvent} from './Event';

type ModelConstructor<T extends Model> = new (...args: never[]) => T;

export abstract class Model extends EventDispatcher {
    private subModels: Map<ModelConstructor<Model>, Model> = new Map();

    addModel<T extends Model>(model: T): void {
        // Every stored model is keyed by its concrete constructor for add/get/remove symmetry.
        const key = model.constructor as ModelConstructor<Model>;
        if (this.subModels.has(key)) {
            throw new Error(`Model of type '${key.name}' already exists`);
        }
        this.subModels.set(key, model);
    }

    removeModel<T extends Model>(modelClass: ModelConstructor<T>): void {
        const model = this.subModels.get(modelClass);
        if (model) {
            model.destroy();
            this.subModels.delete(modelClass);
        }
    }

    getModel<T extends Model>(modelClass: ModelConstructor<T>): T | undefined {
        return this.subModels.get(modelClass) as T | undefined;
    }

    hasModel<T extends Model>(modelClass: ModelConstructor<T>): boolean {
        return this.subModels.has(modelClass);
    }

    protected emitChange<T = unknown>(type: string, data?: T): void {
        this.dispatchEvent(new GameEvent(type, data));
    }

    destroy(): void {
        this.subModels.forEach(model => model.destroy());
        this.subModels.clear();
        this.removeAllListeners();
    }
}

