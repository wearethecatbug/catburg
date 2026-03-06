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
            setIsReady(false);
        };
    }, []);

    return {containerRef, applicationRef, isReady};
}