import {AnimatedSprite, Application} from 'pixi.js';

export type PageHitbox = { left: number; top: number; right: number; bottom: number };

const collisionEventTarget = new EventTarget();

export function rectanglesIntersect(a: PageHitbox, b: PageHitbox): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function computeSpritePageHitbox(
    application: Application,
    animatedSprite: AnimatedSprite
): PageHitbox | null {
    const canvasElement = application.view as HTMLCanvasElement | undefined;
    if (!canvasElement || !animatedSprite) return null;

    const canvasRectangle = canvasElement.getBoundingClientRect();
    const internalWidth = canvasElement.width || 1;
    const internalHeight = canvasElement.height || 1;
    const scaleX = canvasRectangle.width / internalWidth;
    const scaleY = canvasRectangle.height / internalHeight;

    const bounds = animatedSprite.getBounds(); // координаты канвы
    const left = canvasRectangle.left + bounds.x * scaleX;
    const top = canvasRectangle.top + bounds.y * scaleY;
    const right = left + bounds.width * scaleX;
    const bottom = top + bounds.height * scaleY;

    return {left, top, right, bottom};
}

export function startHitboxEmitter(
    entityKey: string,
    application: Application,
    animatedSprite: AnimatedSprite
): () => void {
    const emit = () => {
        const hitbox = computeSpritePageHitbox(application, animatedSprite);
        if (!hitbox) return;
        collisionEventTarget.dispatchEvent(new CustomEvent<PageHitbox>(`hitbox:${entityKey}`, {detail: hitbox}));
    };
    application.ticker.add(emit);
    return () => application.ticker.remove(emit);
}

export function onCollisionWithEntity(
    otherEntityKey: string,
    application: Application,
    animatedSprite: AnimatedSprite,
    onChange: (isIntersecting: boolean, payload: { self: PageHitbox; other: PageHitbox }) => void
): () => void {
    let lastState = false;

    const handler = (event: Event) => {
        const otherHitbox = (event as CustomEvent<PageHitbox>).detail;
        const selfHitbox = computeSpritePageHitbox(application, animatedSprite);
        if (!selfHitbox) return;

        const now = rectanglesIntersect(selfHitbox, otherHitbox);
        if (now !== lastState) {
            lastState = now;
            onChange(now, {self: selfHitbox, other: otherHitbox});
        }
    };

    collisionEventTarget.addEventListener(`hitbox:${otherEntityKey}`, handler as EventListener);
    return () =>
        collisionEventTarget.removeEventListener(`hitbox:${otherEntityKey}`, handler as EventListener);
}