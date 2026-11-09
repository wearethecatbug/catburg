import {Application} from 'pixi.js';
import {useEffect, useRef, useState} from 'react';


export function usePixiApplication() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const applicationRef = useRef<Application | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const containerElement = containerRef.current;
        if (!containerElement || applicationRef.current) return;

        let isCancelled = false;
        const application = new Application();
        applicationRef.current = application;

        (async () => {
            await application.init({autoStart: false, backgroundAlpha: 0, clearBeforeRender: true});
            if (isCancelled) return;
            containerElement.appendChild(application.canvas);
            application.resizeTo = containerElement;
            application.start();
            setIsReady(true);
        })();

        return () => {
            isCancelled = true;
            const app = applicationRef.current;
            try {
                app?.stop?.();
            } catch {
                // Cleanup continues so later Pixi resources are still released.
            }
            try {
                // The Pixi setter clears its resize target for a falsy value, including undefined.
                if (app) Reflect.set(app, 'resizeTo', undefined);
            } catch {
                // Cleanup continues so later Pixi resources are still released.
            }
            try {
                app?.stage?.removeChildren?.();
            } catch {
                // Cleanup continues so later Pixi resources are still released.
            }
            try {
                app?.ticker?.stop?.();
            } catch {
                // Cleanup continues so later Pixi resources are still released.
            }
            try {
                app?.renderer?.destroy?.();
            } catch {
                // Cleanup continues so later Pixi resources are still released.
            }
            try {
                app?.canvas?.remove?.();
            } catch {
                // Cleanup continues so later Pixi resources are still released.
            }
            try {
                app?.destroy?.(true, {children: true});
            } catch {
                // Cleanup continues so later Pixi resources are still released.
            }
            applicationRef.current = null;
            setIsReady(false);
        };
    }, []);

    return {containerRef, applicationRef, isReady};
}
