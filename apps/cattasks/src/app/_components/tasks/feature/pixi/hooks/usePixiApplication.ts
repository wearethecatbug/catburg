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
                // A partially initialized Pixi application may already be stopped.
            }
            try {
                // Pixi's installed runtime setter accepts a falsey resize target to detach its listener,
                // while its narrower declaration only admits Window or HTMLElement.
                if (app) Reflect.set(app, 'resizeTo', undefined);
            } catch {
                // Resize plugin cleanup is best-effort during unmount.
            }
            try {
                app?.stage?.removeChildren?.();
            } catch {
                // Stage cleanup is best-effort during unmount.
            }
            try {
                app?.ticker?.stop?.();
            } catch {
                // Ticker cleanup is best-effort during unmount.
            }
            try {
                app?.renderer?.destroy?.();
            } catch {
                // Renderer cleanup is best-effort during unmount.
            }
            try {
                app?.canvas?.remove?.();
            } catch {
                // Canvas cleanup is best-effort during unmount.
            }
            try {
                app?.destroy?.(true, {children: true});
            } catch {
                // Destroy may be called after an earlier cleanup step already released resources.
            }
            applicationRef.current = null;
            setIsReady(false);
        };
    }, []);

    return {containerRef, applicationRef, isReady};
}
