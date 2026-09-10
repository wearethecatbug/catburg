import {GameEvent} from './Event';

type EventListener<T = unknown> = (event: GameEvent<T>) => void;

interface ListenerEntry {
    callback: EventListener;
    once: boolean;
}

export class EventDispatcher {
    private listeners: Map<string, ListenerEntry[]> = new Map();

    addEventListener<T = unknown>(
        type: string,
        callback: EventListener<T>,
        options?: { once?: boolean }
    ): void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }

        const entry: ListenerEntry = {
            callback: callback as EventListener,
            once: options?.once ?? false,
        };

        this.listeners.get(type)!.push(entry);
    }

    removeEventListener<T = unknown>(type: string, callback: EventListener<T>): void {
        const entries = this.listeners.get(type);
        if (!entries) return;

        const index = entries.findIndex(e => e.callback === callback);
        if (index !== -1) {
            entries.splice(index, 1);
        }

        if (entries.length === 0) {
            this.listeners.delete(type);
        }
    }

    dispatchEvent<T = unknown>(event: GameEvent<T>): void {
        const entries = this.listeners.get(event.type);
        if (!entries || entries.length === 0) return;

        const entriesToCall = [...entries];
        const onceListeners: EventListener[] = [];

        for (const entry of entriesToCall) {
            entry.callback(event);
            if (entry.once) {
                onceListeners.push(entry.callback);
            }
        }

        for (const listener of onceListeners) {
            this.removeEventListener(event.type, listener);
        }
    }

    removeAllListeners(type?: string): void {
        if (type) {
            this.listeners.delete(type);
        } else {
            this.listeners.clear();
        }
    }

    hasListeners(type: string): boolean {
        const entries = this.listeners.get(type);
        return entries !== undefined && entries.length > 0;
    }

    getListenerCount(type: string): number {
        return this.listeners.get(type)?.length ?? 0;
    }
}

