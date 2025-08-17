'use client';
import {AnimatedSprite, Application, Assets, Spritesheet, Texture, TextureSource} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';
import styles from './Doggy.module.css';

export default function Doggy() {
    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const spriteRef = useRef<AnimatedSprite | null>(null);
    const [animations, setAnimations] = useState<Record<string | number, Texture<TextureSource<any>>[]>>();
    const [currentAnimation, setCurrentAnimation] = useState<string>('Idle');


    if (animations && spriteRef.current) {
        spriteRef.current.textures = animations[currentAnimation] || [];
        spriteRef.current.play();
    }


    useEffect(() => {
            if (!pixiContainerRef.current) return;
            const app = new Application({
                resizeTo: pixiContainerRef.current,
                autoStart: true,
                backgroundColor: 0xFF00FF,
                backgroundAlpha: 0,
                clearBeforeRender: true,
            });
            let sprite: AnimatedSprite | null = null;

            const handleResize = () => {
                if (sprite && app.renderer) {
                    const width = app.renderer.width;
                    const height = app.renderer.height;
                    sprite.x = width / 2;
                    sprite.y = height / 2;
                    // Сохраняем аспектное соотношение
                    if (sprite.texture.width && sprite.texture.height) {
                        const scale = Math.min(
                            width / sprite.texture.width,
                            height / sprite.texture.height
                        );
                        sprite.scale.set(scale);
                    }
                }
            };


            app.init({
                resizeTo: pixiContainerRef.current,
                width: 400,
                height: 300,
                autoStart: true,
                backgroundAlpha: 0,                        // прозрачный canvas
                clearBeforeRender: true,
                // backgroundColor: 0x000000,              // не нужен при alpha=0
            }).then(async () => {
                pixiContainerRef.current!.appendChild(app.canvas);
                app.canvas.style.width = '100%';
                app.canvas.style.height = '100%';
                try {
                    const atlas = await Assets.load<Spritesheet>('sheet.json');
                    const animations = atlas.animations;
                    sprite = new AnimatedSprite(animations[currentAnimation] || [], true);
                    sprite.anchor.set(0.5);
                    // Центрируем спрайт и масштабируем с сохранением аспекта
                    sprite.x = app.renderer.width / 2;
                    sprite.y = app.renderer.height / 2;
                    if (sprite.texture.width && sprite.texture.height) {
                        const scale = Math.min(
                            app.renderer.width / sprite.texture.width,
                            app.renderer.height / sprite.texture.height
                        );
                        sprite.scale.set(scale);
                    }
                    sprite.animationSpeed = 0.1;
                    sprite.play();
                    app.stage.addChild(sprite);
                    spriteRef.current = sprite;
                    setAnimations(animations);
                } catch (error) {
                    console.error('Error loading atlas:', error);
                }
                window.addEventListener('resize', handleResize);
            }).catch((error) => {
                console.error('Error initializing PixiJS application:', error);
            });

            return () => {
                app.destroy(true, {children: true});
                window.removeEventListener('resize', handleResize);
            };
        }
        ,
        []
    )
    ;

    // Обработчик нажатия клавиши
    function handleKeyDown(e: KeyboardEvent) {
        if (!spriteRef.current || !pixiContainerRef.current) return;
        const containerWidth = pixiContainerRef.current.offsetWidth;
        const halfSprite = spriteRef.current.width / 2;
        // Проверка границ контейнера
        if (e.key === 'ArrowRight') {
            let newX = spriteRef.current.x + 5;
            // Ограничение справа
            if (newX > containerWidth - halfSprite) newX = containerWidth - halfSprite;
            spriteRef.current.x = newX;
            spriteRef.current.scale.x = 1;
            setCurrentAnimation('Walk');
        }
        if (e.key === 'ArrowLeft') {
            let newX = spriteRef.current.x - 5;
            // Ограничение слева
            if (newX < halfSprite) newX = halfSprite;
            spriteRef.current.x = newX;
            spriteRef.current.scale.x = -1;
            setCurrentAnimation('Walk');
        }
    }

    // Обработчик отпускания клавиши
    function handleKeyUp(e: KeyboardEvent) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            setCurrentAnimation('Idle');
        }
    }

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return (
        <div
            className={styles.doggySprite}
            ref={pixiContainerRef}
        />
    );
}
