import {AnimatedSprite, Texture, TextureSource} from 'pixi.js';

export type SpriteLayout = {
    scaleX: number; scaleY: number;
    containerWidth: number; containerHeight: number;
    spriteX: number; spriteY: number;
};

export function computeFrameBase(sprite: AnimatedSprite) {
    const texture = (sprite.textures?.[sprite.currentFrame] ?? sprite.texture) as Texture;
    const resolution = (texture.source as TextureSource)?.resolution ?? 1;
    const width = (texture.trim?.width ?? texture.frame?.width ?? texture.width) / resolution;
    const height = (texture.trim?.height ?? texture.frame?.height ?? texture.height) / resolution;
    return {width, height};
}

export function computeSpriteLayoutForBox(
    base: { width: number; height: number },
    availableWidth: number,
    availableHeight: number,
    currentScaleX: number
): SpriteLayout {
    const scaleFactor = Math.min(availableWidth / base.width, availableHeight / base.height, 1);
    const containerWidth = Math.ceil(base.width * scaleFactor);
    const containerHeight = Math.ceil(base.height * scaleFactor);
    return {
        scaleX: Math.sign(currentScaleX) * scaleFactor,
        scaleY: scaleFactor,
        containerWidth,
        containerHeight,
        spriteX: containerWidth / 2,
        spriteY: containerHeight / 2,
    };
}