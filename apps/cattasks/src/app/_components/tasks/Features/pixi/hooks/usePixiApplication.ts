import {Application} from 'pixi.js';
import {useEffect, useRef} from 'react';

export function usePixiApplication() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const applicationRef = useRef<Application | null>(null);

    useEffect(() => {
        const containerElement = containerRef.current;
        if (!containerElement || applicationRef.current) return;

        let isCancelled = false;

        const application = new Application();
        applicationRef.current = application;

        (async () => {
            // 1) init без resizeTo и без автостарта
            await application.init({
                autoStart: false,
                backgroundAlpha: 0,
                clearBeforeRender: true,
            });

            if (isCancelled) return;

            // 2) канвас в DOM
            containerElement.appendChild(application.canvas);

            // 3) привязка resize ПОСЛЕ вставки в DOM
            application.resizeTo = containerElement;

            // 4) старт
            application.start();
        })();

        return () => {
            isCancelled = true;

            const app: any = applicationRef.current;

            try {
                app?.stop?.();
            } catch {
            }
            try {
                app && (app.resizeTo = undefined as any);
            } catch {
            }
            try {
                app?.stage?.removeChildren?.();
            } catch {
            }
            try {
                app?.ticker?.stop?.();
            } catch {
            }
            try {
                app?.renderer?.destroy?.();
            } catch {
            }
            try {
                app?.canvas?.remove?.();
            } catch {
            }
            try {
                app?.destroy?.(true, {children: true});
            } catch {
            }

            applicationRef.current = null;
        };
    }, []);

    return {containerRef, applicationRef};
}