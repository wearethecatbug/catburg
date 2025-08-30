// Doggy.tsx
'use client';

import {AnimatedSprite, Assets, Spritesheet, Texture} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';
import styles from './Doggy.module.css';
import {startHitboxEmitter} from './Collision';
import {usePixiApplication} from './pixi/hooks/usePixiApplication';
import {computeFrameBase, computeSpriteLayoutForBox} from './pixi/utils/layout';
import {spriteSheetPaths} from './pixi/assets/manifest';

export default function Doggy() {
    const {containerRef, applicationRef} = usePixiApplication();
    const spriteRef = useRef<AnimatedSprite | null>(null);

    const [animationTexturesMap, setAnimationTexturesMap] =
        useState<Record<string | number, Texture[]>>();
    const [currentAnimation, setCurrentAnimation] = useState<string>('Idle');

    const keyboardStateRef = useRef<{ left: boolean; right: boolean }>({left: false, right: false});

    const setCurrentAnimationIfChanged = (animationName: string) => {
        setCurrentAnimation((previous) => (previous === animationName ? previous : animationName));
    };

    useEffect(() => {
        const application = applicationRef.current;
        const containerElement = containerRef.current;
        if (!application || !containerElement) return;

        let isMounted = true;
        let unsubscribeHitbox: (() => void) | null = null;
        let onTickerUpdate: (() => void) | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const applyLayout = () => {
            const spriteInstance = spriteRef.current;
            if (!spriteInstance) return;

            const base = computeFrameBase(spriteInstance);
            const layout = computeSpriteLayoutForBox(
                base,
                application.renderer.width,
                application.renderer.height,
                spriteInstance.scale.x
            );

            spriteInstance.anchor.set(0, 1);
            spriteInstance.scale.set(layout.scaleY * Math.sign(layout.scaleX), layout.scaleY);
            spriteInstance.x = 0;
            spriteInstance.y = application.renderer.height;
        };

        (async () => {
            const spritesheet = await Assets.load<Spritesheet>(spriteSheetPaths.doggy);
            if (!isMounted) return;

            setAnimationTexturesMap(spritesheet.animations);

            const animatedSprite = new AnimatedSprite(spritesheet.animations[currentAnimation] ?? [], true);
            spriteRef.current = animatedSprite;

            animatedSprite.animationSpeed = 0.5;
            animatedSprite.loop = currentAnimation !== 'Attack';
            animatedSprite.eventMode = 'none';

            application.stage.addChild(animatedSprite);
            applyLayout();

            unsubscribeHitbox = startHitboxEmitter('doggy', application, animatedSprite);

            const handleKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'ArrowLeft' || event.key === 'a') keyboardStateRef.current.left = true;
                if (event.key === 'ArrowRight' || event.key === 'd') keyboardStateRef.current.right = true;
            };
            const handleKeyUp = (event: KeyboardEvent) => {
                if (event.key === 'ArrowLeft' || event.key === 'a') keyboardStateRef.current.left = false;
                if (event.key === 'ArrowRight' || event.key === 'd') keyboardStateRef.current.right = false;
            };
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);

            onTickerUpdate = () => {
                const spriteInstance = spriteRef.current;
                if (!spriteInstance) return;

                const screenWidth = application.renderer.width;
                const screenHeight = application.renderer.height;

                const movementSpeedPixelsPerTick = 3;

                let deltaX = 0;
                if (keyboardStateRef.current.left) deltaX -= movementSpeedPixelsPerTick;
                if (keyboardStateRef.current.right) deltaX += movementSpeedPixelsPerTick;

                if (deltaX !== 0) {
                    const directionSign = deltaX < 0 ? -1 : 1;
                    const absoluteScaleY = Math.abs(spriteInstance.scale.y);
                    const absoluteScaleX = Math.abs(spriteInstance.scale.x);
                    spriteInstance.scale.set(directionSign * absoluteScaleX, absoluteScaleY);
                    setCurrentAnimationIfChanged('Walk');
                } else {
                    setCurrentAnimationIfChanged('Idle');
                }

                spriteInstance.x = Math.max(0, Math.min(screenWidth - spriteInstance.width, spriteInstance.x + deltaX));
                spriteInstance.y = screenHeight;
            };

            application.ticker.add(onTickerUpdate);

            resizeObserver = new ResizeObserver(applyLayout);
            resizeObserver.observe(containerElement);

            const cleanupKeys = () => {
                window.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('keyup', handleKeyUp);
            };
            return cleanupKeys;
        })();

        return () => {
            isMounted = false;

            if (resizeObserver) {
                try {
                    resizeObserver.disconnect();
                } catch {
                }
                resizeObserver = null;
            }

            const app = applicationRef.current;
            if (onTickerUpdate && app) app.ticker.remove(onTickerUpdate);
            onTickerUpdate = null;

            if (unsubscribeHitbox) {
                try {
                    unsubscribeHitbox();
                } catch {
                }
                unsubscribeHitbox = null;
            }

            spriteRef.current = null;
        };
    }, [applicationRef, containerRef, spriteSheetPaths.doggy]);

    useEffect(() => {
        const spriteInstance = spriteRef.current;
        if (!spriteInstance || !animationTexturesMap) return;

        const nextTextures = animationTexturesMap[currentAnimation] ?? [];
        spriteInstance.loop = currentAnimation !== 'Attack';
        spriteInstance.onComplete =
            currentAnimation === 'Attack' ? () => setCurrentAnimation('Idle') : undefined;

        if (spriteInstance.textures !== nextTextures) {
            spriteInstance.textures = nextTextures;
            spriteInstance.gotoAndPlay(0);
        } else {
            spriteInstance.play();
        }
    }, [currentAnimation, animationTexturesMap]);

    return <div ref={containerRef} className={styles.doggySprite} suppressHydrationWarning/>;
}

// export default function Doggy() {
//     const pixiContainerRef = useRef<HTMLDivElement>(null);
//     const spriteRef = useRef<AnimatedSprite | null>(null);
//     const [animations, setAnimations] = useState<Record<string | number, Texture<TextureSource<any>>[]>>();
//     const [currentAnimation, setCurrentAnimation] = useState<string>('Idle');
//     const appRef = useRef<Application | null>(null);
//     const keyboardStateRef = useRef({left: false, right: false});
//     const setAnim = (name: string) =>
//         setCurrentAnimation(prev => (prev === name ? prev : name));
//
//     // Функция для установки текущей анимации
//     useEffect(() => {
//         const container = pixiContainerRef.current;
//         if (!container || appRef.current) return;
//
//         const app = new Application();
//         appRef.current = app;
//
//         let isMounted = true;
//         let onTickerUpdate: (() => void) | null = null;
//         let unsubscribeHitboxEmitter: (() => void) | null = null;
//         let sprite: AnimatedSprite | null = null;
//
//         const handleResize = () => {
//             const app = appRef.current;
//             const sprite = spriteRef.current;
//             if (!app || !sprite) return;
//
//             const width = app.screen.width;
//             const height = app.screen.height;
//             const texture = sprite.texture;
//             const resolution = (texture.source as TextureSource<any>)?.resolution ?? 1;
//             const baseW = (texture.trim?.width ?? texture.frame?.width ?? texture.width) / resolution;
//             const baseH = (texture.trim?.height ?? texture.frame?.height ?? texture.height) / resolution;
//             const sc = Math.min(width / baseW, height / baseH);
//             sprite.scale.set(Math.sign(sprite.scale.x) * Math.abs(sc), sc);
//             const half = frameHalf(sprite);
//             sprite.x = Math.max(half, Math.min(width - half, sprite.x));
//             sprite.y = Math.max(sprite.height / 2, Math.min(height - sprite.height / 2, sprite.y));
//         };
//
//
//         app.init({
//             resizeTo: container,
//             autoStart: true,
//             backgroundAlpha: 0, // прозрачный фон
//             clearBeforeRender: true,
//         }).then(async () => {
//             if (!isMounted) {
//                 app.destroy(true, {children: true});
//                 return;
//             }
//             container!.appendChild(app.canvas);
//             try {
//                 const atlas = await Assets.load<Spritesheet>('sheet.json');
//                 const animations = atlas.animations;
//                 sprite = new AnimatedSprite(animations[currentAnimation] || [], true);
//
//                 sprite.anchor.set(0.5);
//                 const texture = sprite.texture;
//                 const resolution = (texture.source as TextureSource<any>)?.resolution ?? 1;
//                 const baseW = (texture.trim?.width ?? texture.frame?.width ?? texture.width) / resolution;
//                 const baseH = (texture.trim?.height ?? texture.frame?.height ?? texture.height) / resolution;
//                 const sc = Math.min(app.screen.width / baseW, app.screen.height / baseH);
//                 const sign = Math.sign(sprite.scale.x) || 1;
//                 sprite.scale.set(sign * Math.abs(sc), sc);
//                 // Центрируем спрайт и масштабируем с сохранением аспекта
//                 sprite.x = frameHalf(sprite);
//                 sprite.y = app.screen.height / 2;
//                 sprite.animationSpeed = 0.1;
//                 sprite.play();
//                 app.stage.addChild(sprite);
//                 spriteRef.current = sprite;
//
//                 // запуск эмиттера хитбокса Doggy (один раз)
//                 unsubscribeHitboxEmitter = startHitboxEmitter('doggy', app, sprite);
//
//                 setAnimations(animations);
//                 handleResize();
//                 const SPEED = 3;
//                 const t = () => {
//                     const a = appRef.current;
//                     const s = spriteRef.current;
//                     if (!a || !s) return;
//                     const dir = (keyboardStateRef.current.right ? 1 : 0) - (keyboardStateRef.current.left ? 1 : 0);
//                     if (dir) s.x += SPEED * dir;
//                     const w = a.screen.width;
//                     const half = frameHalf(s);
//                     const left = Math.ceil(half);
//                     const right = Math.floor(w - half);
//                     s.x = Math.max(left, Math.min(right, s.x));
//                 };
//                 onTickerUpdate = t;
//                 app.ticker.add(t);
//             } catch (error) {
//                 console.error('Error loading atlas:', error);
//             }
//             window.addEventListener('resize', handleResize);
//             handleResize();
//         }).catch((error) => {
//             console.error('Error initializing PixiJS application:', error);
//         });
//
//         return () => {
//             isMounted = false;
//             window.removeEventListener('resize', handleResize);
//             if (onTickerUpdate) {
//                 appRef.current?.ticker.remove(onTickerUpdate);
//                 onTickerUpdate = null;
//             }
//             if (unsubscribeHitboxEmitter) {
//                 unsubscribeHitboxEmitter();
//                 unsubscribeHitboxEmitter = null;
//             }
//             // рекомендуется освободить WebGL-контекст, если App создан здесь
//             // if (appRef.current) appRef.current.destroy(true);
//             appRef.current = null;
//             spriteRef.current = null;
//         };
//     }, []);
//
//     function frameHalf(s: AnimatedSprite) {
//         const texture = (s.textures?.[s.currentFrame] ?? s.texture) as Texture;
//         const resolution = (texture.source as TextureSource<any>)?.resolution ?? 1;
//         const baseW = (texture.trim?.width ?? texture.frame?.width ?? texture.width) / resolution;
//         return (baseW * Math.abs(s.scale.x)) / 2;
//     }
//
//
//     function handleKeyDown(e: KeyboardEvent) {
//         const app = appRef.current;
//         const sprite = spriteRef.current;
//         if (!app || !sprite) return;
//
//         if (e.key === 'ArrowRight') {
//             // отражение вправо
//             if (!keyboardStateRef.current.right) {
//                 keyboardStateRef.current.right = true;
//                 if (sprite) sprite.scale.x = Math.abs(sprite.scale.x) || 1;
//                 setAnim('Walk');
//             }
//             e.preventDefault();
//         }
//
//         if (e.key === 'ArrowLeft') {
//             // отражение влево
//             if (!keyboardStateRef.current.left) {
//                 keyboardStateRef.current.left = true;
//                 if (sprite) sprite.scale.x = -(Math.abs(sprite.scale.x) || 1);
//                 setAnim('Walk');
//             }
//             e.preventDefault();
//         }
//     }
//
//
//     function handleKeyUp(e: KeyboardEvent) {
//         if (e.key === 'ArrowRight') keyboardStateRef.current.right = false;
//         if (e.key === 'ArrowLeft') keyboardStateRef.current.left = false;
//         if (!keyboardStateRef.current.left && !keyboardStateRef.current.right) setAnim('Idle');
//     }
//
//     // Добавляем обработчики событий клавиатуры и удаляем их при размонтировании компонента
//     useEffect(() => {
//         const opt: AddEventListenerOptions = {passive: false};
//         window.addEventListener('keydown', handleKeyDown, opt);
//         window.addEventListener('keyup', handleKeyUp, opt);
//         return () => {
//             window.removeEventListener('keydown', handleKeyDown, opt as any);
//             window.removeEventListener('keyup', handleKeyUp, opt as any);
//         };
//     }, []);
//
//     // Обновляем анимацию при смене текущей анимации и при изменении списка анимаций
//     useEffect(() => {
//         const sprite = spriteRef.current;
//         if (!sprite || !animations) return;
//         const next = animations[currentAnimation] || [];
//         if (sprite.textures !== next) {
//             sprite.textures = next;
//             sprite.gotoAndPlay(0);
//         } else {
//             sprite.play();
//         }
//     }, [currentAnimation, animations]);
//
//     return (
//         <div
//             className={styles.doggySprite}
//             ref={pixiContainerRef}
//             // onClick={switchAnimation}
//             suppressHydrationWarning
//         />
//     );
// }
//
//
