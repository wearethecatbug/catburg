import type {AnimatedSprite} from 'pixi.js';
import type {ViewportBounds} from '@/app/_components/tasks/feature/pixi/hooks/useViewportBounds';

export function clampSpritePosition(target: AnimatedSprite, bounds: ViewportBounds): void {
    const minX = bounds.left + target.width * target.anchor.x;
    const maxX = bounds.right - target.width * (1 - target.anchor.x);
    const minY = bounds.top + target.height * target.anchor.y;
    const maxY = bounds.bottom - target.height * (1 - target.anchor.y);

    target.x = Math.min(maxX, Math.max(minX, target.x));
    target.y = Math.min(maxY, Math.max(minY, target.y));
}