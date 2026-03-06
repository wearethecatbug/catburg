export class GameEvent<T = any> {
    readonly type: string;
    readonly data: T;
    readonly timestamp: number;

    constructor(type: string, data?: T) {
        this.type = type;
        this.data = data as T;
        this.timestamp = performance.now();
    }
}

