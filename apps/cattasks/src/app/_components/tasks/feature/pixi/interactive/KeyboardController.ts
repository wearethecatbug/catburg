export enum Keys {
    A = 'A',
    B = 'B',
    C = 'C',
    D = 'D',
    E = 'E',
    F = 'F',
    G = 'G',
    H = 'H',
    I = 'I',
    J = 'J',
    K = 'K',
    L = 'L',
    M = 'M',
    N = 'N',
    O = 'O',
    P = 'P',
    Q = 'Q',
    R = 'R',
    S = 'S',
    T = 'T',
    U = 'U',
    V = 'V',
    W = 'W',
    X = 'X',
    Y = 'Y',
    Z = 'Z',
    Space = 'SPACE',
    Enter = 'ENTER',
    Escape = 'ESCAPE',
    Shift = 'SHIFT',
    Control = 'CTRL',
    Alt = 'ALT',
    ArrowUp = 'ARROWUP',
    ArrowDown = 'ARROWDOWN',
    ArrowLeft = 'ARROWLEFT',
    ArrowRight = 'ARROWRIGHT',
}

export type KeySpec = Keys | string | Array<Keys | string>;

export interface KeyListenerPayload {
    event: KeyboardEvent;
    pressedKeys: ReadonlySet<string>;
    keys: string[]; // listener keys
    combo: boolean;
    type: 'down' | 'up';
}

export interface KeyListenerOptions {
    on?: 'down' | 'up';
    fireOnRepeat?: boolean;
    preventDefault?: boolean;
    fireOnce?: boolean;
}

interface InternalListener {
    id: number;
    keys: string[]; // sorted normalized
    type: 'down' | 'up';
    combo: boolean;
    callback: (payload: KeyListenerPayload) => void;
    fireOnRepeat: boolean;
    preventDefault: boolean;
    fireOnce: boolean;
    active: boolean;
}

const KEY_NORMALIZE_MAP: Record<string, string> = {
    ' ': Keys.Space,
    Space: Keys.Space,
    Spacebar: Keys.Space,
    Enter: Keys.Enter,
    Return: Keys.Enter,
    Escape: Keys.Escape,
    Esc: Keys.Escape,
    Shift: Keys.Shift,
    ShiftLeft: Keys.Shift,
    ShiftRight: Keys.Shift,
    Control: Keys.Control,
    Ctrl: Keys.Control,
    Alt: Keys.Alt,
    ArrowUp: Keys.ArrowUp,
    ArrowDown: Keys.ArrowDown,
    ArrowLeft: Keys.ArrowLeft,
    ArrowRight: Keys.ArrowRight,
};

function normalizeKey(key: string): string {
    const upper = key.length === 1 ? key.toUpperCase() : key;
    return KEY_NORMALIZE_MAP[upper] || upper.toUpperCase();
}

function normalizeSpec(spec: KeySpec): string[] {
    const arr = Array.isArray(spec) ? spec : [spec];
    const out = arr.map(k => normalizeKey(String(k)));
    out.sort();
    return out;
}

function makeSignature(keys: string[]): string {
    return keys.join('+');
}

export class KeyboardController {
    private pressed: Set<string> = new Set();
    private listeners: Map<number, InternalListener> = new Map();
    private comboActiveSignatures: Set<string> = new Set();
    private nextId = 1;
    private keyDownHandler: (e: KeyboardEvent) => void;
    private keyUpHandler: (e: KeyboardEvent) => void;
    private attached = false;
    private blurHandler: () => void;
    private visibilityHandler: () => void;

    constructor(autoAttach: boolean = true) {
        this.keyDownHandler = (e) => this.onKeyDown(e);
        this.keyUpHandler = (e) => this.onKeyUp(e);
        this.blurHandler = () => this.resetAll();
        this.visibilityHandler = () => { if (typeof document !== 'undefined' && document.hidden) this.resetAll(); };
        if (autoAttach) this.attach();
    }

    getPressedKeys(): string[] {
        return Array.from(this.pressed.values()).sort();
    }

    getPressedKeysString(delimiter: string = ' '): string {
        return this.getPressedKeys().join(delimiter);
    }

    attach() {
        if (this.attached) return;
        if (typeof window === 'undefined') return;
        window.addEventListener('keydown', this.keyDownHandler);
        window.addEventListener('keyup', this.keyUpHandler);
        window.addEventListener('blur', this.blurHandler);
        window.addEventListener('visibilitychange', this.visibilityHandler);
        this.attached = true;
    }

    detach() {
        if (!this.attached) return;
        if (typeof window === 'undefined') return;
        window.removeEventListener('keydown', this.keyDownHandler);
        window.removeEventListener('keyup', this.keyUpHandler);
        window.removeEventListener('blur', this.blurHandler);
        window.removeEventListener('visibilitychange', this.visibilityHandler);
        this.attached = false;
    }

    destroy() {
        this.detach();
        this.listeners.clear();
        this.comboActiveSignatures.clear();
        this.pressed.clear();
        this.resetAll();
    }

    isKeyPressed(key: Keys | string): boolean {
        return this.pressed.has(normalizeKey(String(key)));
    }

    isKeyIsPress(key: Keys | string): boolean { // alias per user wording
        return this.isKeyPressed(key);
    }

    addEventListener(spec: KeySpec, callback: (payload: KeyListenerPayload) => void, options?: KeyListenerOptions): number {
        const keys = normalizeSpec(spec);
        const listener: InternalListener = {
            id: this.nextId++,
            keys,
            type: options?.on ?? 'down',
            combo: keys.length > 1,
            callback,
            fireOnRepeat: !!options?.fireOnRepeat,
            preventDefault: !!options?.preventDefault,
            fireOnce: !!options?.fireOnce,
            active: true,
        };
        this.listeners.set(listener.id, listener);
        return listener.id;
    }

    removeEventListener(id: number) {
        const l = this.listeners.get(id);
        if (!l) return;
        this.listeners.delete(id);
        if (l.combo) this.comboActiveSignatures.delete(makeSignature(l.keys));
    }

    private resetAll() {
        if (this.pressed.size === 0 && this.comboActiveSignatures.size === 0) return;
        this.pressed.clear();
        this.comboActiveSignatures.clear();
    }

    private onKeyDown(e: KeyboardEvent) {
        const key = normalizeKey(e.key);
        const beforeHad = this.pressed.has(key);
        this.pressed.add(key);

        this.dispatch('down', e, key, beforeHad ? e.repeat : false);
    }

    private onKeyUp(e: KeyboardEvent) {
        const key = normalizeKey(e.key);
        if (this.pressed.has(key)) this.pressed.delete(key);
        this.dispatch('up', e, key, false);
        // reset combos containing this key
        this.listeners.forEach(l => {
            if (l.combo && l.keys.includes(key)) {
                this.comboActiveSignatures.delete(makeSignature(l.keys));
            }
        });
    }

    private dispatch(type: 'down' | 'up', event: KeyboardEvent, eventKey: string, isRepeat: boolean) {
        this.listeners.forEach(l => {
            if (!l.active) return;
            if (l.type !== type) return;
            if (event.repeat && !l.fireOnRepeat && type === 'down') return;
            const signature = makeSignature(l.keys);
            if (l.combo) {
                for (const k of l.keys) {
                    if (!this.pressed.has(k)) return;
                }
                if (type === 'down') {
                    if (this.comboActiveSignatures.has(signature)) return;
                    if (!l.keys.includes(eventKey)) return; // fire only when one of combo keys pressed now
                    this.comboActiveSignatures.add(signature);
                }
            } else {
                if (l.keys[0] !== eventKey) return;
            }
            if (l.preventDefault) event.preventDefault();
            l.callback({
                event,
                pressedKeys: this.pressed,
                keys: l.keys,
                combo: l.combo,
                type,
            });
            if (l.fireOnce) {
                l.active = false;
                this.removeEventListener(l.id);
            }
        });
    }
}

export const keyboardControllerSingleton = new KeyboardController(true);
