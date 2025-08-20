'use client';
import {AnimatedSprite, Application, Assets, Spritesheet, Texture, TextureSource} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';
import styles from './Doggy.module.css';

export default function Doggy() {
    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const spriteRef = useRef<AnimatedSprite | null>(null);
    const [animations, setAnimations] = useState<Record<string | number, Texture<TextureSource<any>>[]>>();
    const [currentAnimation, setCurrentAnimation] = useState<string>('Idle');
    const appRef = useRef<Application | null>(null);
    const keysRef = useRef({left: false, right: false});
    const setAnim = (name: string) =>
        setCurrentAnimation(prev => (prev === name ? prev : name));

    useEffect(() => {

            if (!pixiContainerRef.current) return;
            const app = new Application();
            appRef.current = app;
            let sprite: AnimatedSprite | null = null;
            let tick: () => void;

            const handleResize = () => {
                const app = appRef.current;
                const sprite = spriteRef.current;
                if (!app || !sprite) return;

                const w = app.screen.width;
                const h = app.screen.height;
                const t = sprite.texture;
                const resolution = (t.source as TextureSource<any>)?.resolution ?? 1;
                const baseW = (t.trim?.width ?? t.frame?.width ?? t.width) / resolution;
                const baseH = (t.trim?.height ?? t.frame?.height ?? t.height) / resolution;
                const sc = Math.min(w / baseW, h / baseH);
                sprite.scale.set(Math.sign(sprite.scale.x) * Math.abs(sc), sc);
                const half = frameHalf(sprite);
                sprite.x = Math.max(half, Math.min(w - half, sprite.x));
                sprite.y = Math.max(sprite.height / 2, Math.min(h - sprite.height / 2, sprite.y));
            };


            app.init({
                resizeTo: pixiContainerRef.current,
                autoStart: true,
                backgroundAlpha: 0, // прозрачный фон
                clearBeforeRender: true,
            }).then(async () => {
                pixiContainerRef.current!.appendChild(app.canvas);
                try {
                    const atlas = await Assets.load<Spritesheet>('sheet.json');
                    const animations = atlas.animations;
                    sprite = new AnimatedSprite(animations[currentAnimation] || [], true);
                    sprite.anchor.set(0.5);
                    const texture = sprite.texture;
                    const resolution = (texture.source as TextureSource<any>)?.resolution ?? 1;
                    const baseW = (texture.trim?.width ?? texture.frame?.width ?? texture.width) / resolution;
                    const baseH = (texture.trim?.height ?? texture.frame?.height ?? texture.height) / resolution;
                    const sc = Math.min(app.screen.width / baseW, app.screen.height / baseH);
                    const sign = Math.sign(sprite.scale.x) || 1;
                    sprite.scale.set(sign * Math.abs(sc), sc);
                    // Центрируем спрайт и масштабируем с сохранением аспекта
                    sprite.x = frameHalf(sprite);
                    sprite.y = app.screen.height / 2;
                    // if (sprite.texture.width && sprite.texture.height) {
                    //     const sign = Math.sign(sprite.scale.x) || 1;
                    // }
                    sprite.animationSpeed = 0.1;
                    sprite.play();
                    app.stage.addChild(sprite);
                    spriteRef.current = sprite;
                    setAnimations(animations);
                    handleResize(); // сразу
                    const SPEED = 3;
                    const t = () => {
                        const a = appRef.current;
                        const s = spriteRef.current;
                        if (!a || !s) return;
                        const dir = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
                        if (dir) s.x += SPEED * dir;
                        const w = a.screen.width;
                        const half = frameHalf(s);
                        const left = Math.ceil(half);
                        const right = Math.floor(w - half);
                        s.x = Math.max(left, Math.min(right, s.x));
                    };
                    tick = t;
                    app.ticker.add(t);
                } catch (error) {
                    console.error('Error loading atlas:', error);
                }
                window.addEventListener('resize', handleResize);
            }).catch((error) => {
                console.error('Error initializing PixiJS application:', error);
            });

            return () => {
                if (tick) app.ticker.remove(tick);
                app.destroy(true, {children: true});
                window.removeEventListener('resize', handleResize);
                appRef.current = null;
                spriteRef.current = null;
            };
        }
        ,
        []
    );

    function frameHalf(s: AnimatedSprite) {
        const t = (s.textures?.[s.currentFrame] ?? s.texture) as Texture;
        const resolution = (t.source as TextureSource<any>)?.resolution ?? 1;
        const baseW = (t.trim?.width ?? t.frame?.width ?? t.width) / resolution;
        return (baseW * Math.abs(s.scale.x)) / 2;
    }

    // Обработчик нажатия клавиши
    function handleKeyDown(e: KeyboardEvent) {
        const app = appRef.current;
        const sprite = spriteRef.current;
        if (!app || !sprite) return;

        if (e.key === 'ArrowRight') {
            // отражение вправо
            if (!keysRef.current.right) {
                keysRef.current.right = true;
                if (sprite) sprite.scale.x = Math.abs(sprite.scale.x) || 1;
                setAnim('Walk');
            }
            e.preventDefault();
        }

        if (e.key === 'ArrowLeft') {
            // отражение влево
            if (!keysRef.current.left) {
                keysRef.current.left = true;
                if (sprite) sprite.scale.x = -(Math.abs(sprite.scale.x) || 1);
                setAnim('Walk');
            }
            e.preventDefault();
        }
    }

    // Обработчик отпускания клавиши
    function handleKeyUp(e: KeyboardEvent) {
        if (e.key === 'ArrowRight') keysRef.current.right = false;
        if (e.key === 'ArrowLeft') keysRef.current.left = false;
        if (!keysRef.current.left && !keysRef.current.right) setAnim('Idle');
    }

    useEffect(() => {
        const opt: AddEventListenerOptions = {passive: false};
        window.addEventListener('keydown', handleKeyDown, opt);
        window.addEventListener('keyup', handleKeyUp, opt);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, opt as any);
            window.removeEventListener('keyup', handleKeyUp, opt as any);
        };
    }, []);

    useEffect(() => {
        const s = spriteRef.current;
        if (!s || !animations) return;
        const next = animations[currentAnimation] || [];
        if (s.textures !== next) {
            s.textures = next;
            s.gotoAndPlay(0);
        } else {
            s.play();
        }
    }, [currentAnimation, animations]);

    return (
        <div
            className={styles.doggySprite}
            ref={pixiContainerRef}
            // onClick={switchAnimation}
        />
    );
}


