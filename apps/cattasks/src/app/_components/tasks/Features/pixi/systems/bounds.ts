import type {Container} from 'pixi.js';
import type {ViewportBounds} from '../hooks/useViewportBounds';

export function clampSpritePosition(target: Container, viewportBounds: ViewportBounds) {
    const width = target.width;                 // всегда ≥ 0
    const scaleX = (target as any).scale?.x ?? 1;
    const flipped = scaleX < 0;

    // При flipped якорь у правого края спрайта, значит x должен быть ≥ left + width
    const minX = flipped ? viewportBounds.left + width : viewportBounds.left;
    const maxX = flipped ? viewportBounds.right : viewportBounds.right - width;

    target.x = Math.min(Math.max(target.x, minX), maxX);
    // y контролируешь отдельно
}