// при ошибке типов на TextureSource в v8: импортируй из '@pixi/core'
import type {AnimatedSprite, Texture, TextureSource} from 'pixi.js';
import {ViewportBounds} from "@/app/_components/tasks/Features/pixi/systems/movement";

export type FrameBase = { width: number; height: number };
export type SpriteLayout = {
    scaleX: number; scaleY: number;
    containerWidth: number; containerHeight: number;
    spriteX: number; spriteY: number;
};
export type SpriteAlignment =
    | 'center' | 'bottom' | 'top' | 'left' | 'right'
    | 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';

// Вычисляем "базовый" размер спрайта в пикселях без учёта масштабирования (учитываем trim и frame, если есть)
export function computeFrameBase(sprite: AnimatedSprite): FrameBase {
    const texture = (sprite.textures?.[sprite.currentFrame] ?? sprite.texture) as Texture;
    const resolution = (texture.source as TextureSource)?.resolution ?? 1;
    const width = (texture.trim?.width ?? texture.frame?.width ?? texture.width) / resolution;
    const height = (texture.trim?.height ?? texture.frame?.height ?? texture.height) / resolution;
    return {width, height};
}

/** Центрируем спрайт в контейнере и задаём размер контейнера под спрайт */
export function applyCenterLayoutToSpriteInContainer(
    sprite: AnimatedSprite,
    containerElement: HTMLElement,
    availableWidth: number,
    availableHeight: number
) {
    const base = computeFrameBase(sprite);
    const layout = computeSpriteLayoutForBox(
        base,
        Math.max(1, availableWidth),
        Math.max(1, availableHeight),
        sprite.scale.x,
        'center'
    );

    sprite.scale.set(layout.scaleX, layout.scaleY);
    containerElement.style.width = `${layout.containerWidth}px`;
    containerElement.style.height = `${layout.containerHeight}px`;

    sprite.anchor.set(0.5);
    sprite.x = layout.containerWidth / 2;
    sprite.y = layout.containerHeight / 2;
}

// Выравниваем спрайт по левому нижнему углу вьюпорта, используя абсолютные координаты
export function applyBottomLeftLayoutToSprite(
    sprite: AnimatedSprite,
    viewportBounds: ViewportBounds
) {

    const base = computeFrameBase(sprite);
    const availableWidth = viewportBounds.right - viewportBounds.left;
    const availableHeight = viewportBounds.bottom - viewportBounds.top;

    const layout = computeSpriteLayoutForBox(
        base,
        availableWidth,
        availableHeight,
        sprite.scale.x,
        'bottomLeft'
    );

    sprite.anchor.set(0, 0);
    sprite.scale.set(layout.scaleX, layout.scaleY);
    // используем абсолютные координаты через spriteX/spriteY
    sprite.x = viewportBounds.left + layout.spriteX;
    sprite.y = viewportBounds.top + layout.spriteY;
}

// Вычисляем параметры для позиционирования спрайта в контейнере с учётом выравнивания и масштабирования по доступной области
export function computeSpriteLayoutForBox(
    base: FrameBase,
    availableWidth: number,
    availableHeight: number,
    currentScaleX: number,
    alignment: SpriteAlignment = 'bottomLeft'
): SpriteLayout {
    const scaleFactor = Math.min(availableWidth / base.width, availableHeight / base.height, 1);
    const containerWidth = Math.ceil(base.width * scaleFactor);
    const containerHeight = Math.ceil(base.height * scaleFactor);

    // координаты спрайта в контейнере при anchor=(0,0)
    const positions: Record<SpriteAlignment, { x: number; y: number }> = {
        center: {x: (availableWidth - containerWidth) / 2, y: (availableHeight - containerHeight) / 2},
        bottom: {x: (availableWidth - containerWidth) / 2, y: availableHeight - containerHeight},
        top: {x: (availableWidth - containerWidth) / 2, y: 0},
        left: {x: 0, y: (availableHeight - containerHeight) / 2},
        right: {x: availableWidth - containerWidth, y: (availableHeight - containerHeight) / 2},
        bottomLeft: {x: 0, y: availableHeight - containerHeight},
        bottomRight: {x: availableWidth - containerWidth, y: availableHeight - containerHeight},
        topLeft: {x: 0, y: 0},
        topRight: {x: availableWidth - containerWidth, y: 0},
    };

    const {x, y} = positions[alignment];

    return {
        scaleX: Math.sign(currentScaleX) * scaleFactor,
        scaleY: scaleFactor,
        containerWidth,
        containerHeight,
        spriteX: x,
        spriteY: y,
    };
}

