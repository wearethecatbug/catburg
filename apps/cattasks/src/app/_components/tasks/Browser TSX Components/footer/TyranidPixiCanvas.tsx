'use client';

import {useEffect, useLayoutEffect, useRef, type RefObject} from 'react';
import type {TyranidActor as TyranidActorInstance, TyranidAnimation, TyranidSnapshot} from '../../feature/pixi/petstrip/TyranidActor';
import styles from './PetStrip.module.css';

type Travel = {from: number; startedAt: number; duration: number} | null;
type Props = {trackRef: RefObject<HTMLSpanElement | null>; position: number; biteTarget: number | null; direction: 'left' | 'right'; state: TyranidAnimation; stateStartedAt: number | null; travel: Travel};
type Pixi = typeof import('pixi.js');
const ATLAS = '/cattasks/themes/shared/tyranid/tyranid-all-actions-v3.png';
const X = [0, 194, 387, 580, 774, 968], Y = [0, 194, 387, 581, 774, 968, 1161];
const WIDTH = [194, 193, 193, 194, 194, 193], HEIGHT = [194, 193, 194, 193, 194, 193, 194];
const ORIGIN: Record<number, number> = {0: 157, 1: 157, 2: 157, 6: 159, 7: 159, 8: 159, 10: 159, 11: 159, 12: 152, 13: 152, 14: 152, 15: 152, 16: 152, 17: 152, 18: 146, 19: 147, 20: 146, 21: 145, 22: 146, 23: 146, 24: 136, 25: 136, 26: 136, 27: 136, 28: 136, 29: 136, 36: 109, 37: 109, 41: 109};
export const TYRANID_BITE_OFFSET_PX = 30;

export function projectTyranidBitePosition(target: number | null, direction: 'left' | 'right', trackWidth: number, fallback: number): number {
    if (target === null) return fallback;
    return target + (direction === 'right' ? -1 : 1) * TYRANID_BITE_OFFSET_PX / Math.max(trackWidth, 1) * 100;
}

export default function TyranidPixiCanvas({trackRef, position, biteTarget, direction, state, stateStartedAt, travel}: Props) {
    const host = useRef<HTMLSpanElement>(null);
    const latest = useRef({trackRef, position, biteTarget, direction, state, stateStartedAt, travel});
    const renderLatest = useRef<(() => void) | null>(null);
    useLayoutEffect(() => { latest.current = {trackRef, position, biteTarget, direction, state, stateStartedAt, travel}; }, [trackRef, position, biteTarget, direction, state, stateStartedAt, travel]);
    useEffect(() => { renderLatest.current?.(); }, [position, biteTarget, direction, state, stateStartedAt, travel]);

    useEffect(() => {
        const target = host.current, track = trackRef.current;
        if (!target || !track) return;
        let disposed = false;
        let generation = 0;
        const abort = new AbortController();
        let disposeMounted: (() => void) | undefined;
        void import('pixi.js').then(async (pixi: Pixi) => {
            if (disposed) return;
            const app = new pixi.Application();
            let bitmap: ImageBitmap | null = null;
            let source: import('pixi.js').ImageSource | null = null;
            let textures: import('pixi.js').Texture[] = [];
            let actor: TyranidActorInstance | null = null;
            let observer: ResizeObserver | null = null;
            let reduced: MediaQueryList | null = null;
            let tick: ((ticker: {deltaMS: number}) => void) | null = null;
            let syncTicker: (() => void) | null = null;
            let released = false;
            const release = () => {
                if (released) return;
                released = true;
                if (tick) app.ticker.remove(tick);
                if (reduced && syncTicker) reduced.removeEventListener('change', syncTicker);
                if (syncTicker) document.removeEventListener('visibilitychange', syncTicker);
                observer?.disconnect(); actor?.destroy(); textures.forEach(texture => texture.destroy(false)); source?.destroy(); bitmap?.close();
                if (app.renderer) app.destroy(true); else app.stage.destroy({children: true});
            };
            let published = false;
            try {
                const token = ++generation;
                await app.init({width: target.clientWidth, height: target.clientHeight, resolution: window.devicePixelRatio, autoStart: false, backgroundAlpha: 0, preference: 'webgl'});
                if (disposed || token !== generation || !target.isConnected) return;
                const response = await fetch(ATLAS, {signal: abort.signal});
                if (!response.ok) throw new Error(`Tyranid atlas failed: ${response.status}`);
                const blob = await response.blob();
                if (disposed || token !== generation) return;
                bitmap = await createImageBitmap(blob);
                if (disposed || token !== generation || !target.isConnected) return;
                const atlasSource = new pixi.ImageSource({resource: bitmap});
                source = atlasSource;
                textures = Array.from({length: 42}, (_, index) => {
                    const column = index % 6, row = Math.floor(index / 6), width = WIDTH[column], height = HEIGHT[row];
                    return new pixi.Texture({source: atlasSource, frame: new pixi.Rectangle(X[column], Y[row], width, height), defaultAnchor: {x: .5, y: (ORIGIN[index] ?? 157) / height}});
                });
                const {TyranidActor} = await import('../../feature/pixi/petstrip/TyranidActor');
                if (disposed || token !== generation || !target.isConnected) return;
                reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
                actor = new TyranidActor(textures, {position: 0, groundY: target.clientHeight - 7, direction: 'right', state: 'idle', reducedMotion: reduced.matches, stateStartedAt: null});
                app.stage.addChild(actor.actor.view.sprite); app.ticker.remove(app.render, app);
                app.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; target.appendChild(app.canvas);
                const geometry = {trackLeft: 0, trackWidth: 1, hostWidth: 1, height: target.clientHeight};
                const project = (deltaMS: number, now: number) => {
                    if (document.hidden) return;
                    const current = latest.current, activeTravel = reduced?.matches ? null : current.travel;
                    const bitePosition = projectTyranidBitePosition(current.biteTarget, current.direction, geometry.trackWidth, current.position);
                    const logicalPosition = activeTravel ? activeTravel.from + (bitePosition - activeTravel.from) * Math.min(1, Math.max(0, (now - activeTravel.startedAt) / Math.max(1, activeTravel.duration))) : bitePosition;
                    const snapshot: TyranidSnapshot = {position: geometry.trackLeft + geometry.trackWidth * logicalPosition / 100, groundY: geometry.height - 7, direction: current.direction, state: current.state, reducedMotion: reduced?.matches ?? false, stateStartedAt: current.stateStartedAt};
                    actor?.update(snapshot, deltaMS); app.render();
                };
                const renderStatic = () => project(0, performance.now());
                tick = (ticker: {deltaMS: number}) => project(ticker.deltaMS, performance.now());
                const measure = () => {
                    const trackBounds = track.getBoundingClientRect(), hostBounds = target.getBoundingClientRect();
                    geometry.trackLeft = trackBounds.left - hostBounds.left; geometry.trackWidth = Math.max(1, trackBounds.width); geometry.hostWidth = Math.max(1, hostBounds.width); geometry.height = Math.max(1, target.clientHeight);
                    app.renderer.resize(geometry.hostWidth, geometry.height); renderStatic();
                };
                syncTicker = () => { if (tick) app.ticker.remove(tick); if (!document.hidden && !reduced?.matches && tick) app.ticker.add(tick); renderStatic(); };
                observer = new ResizeObserver(measure); observer.observe(target); observer.observe(track);
                reduced.addEventListener('change', syncTicker); document.addEventListener('visibilitychange', syncTicker);
                app.ticker.start(); measure(); syncTicker();
                renderLatest.current = renderStatic;
                disposeMounted = () => {
                    if (renderLatest.current === renderStatic) renderLatest.current = null;
                    release();
                };
                published = true;
            } catch {
                // The finally owner closes any partial bitmap/texture/Application.
            } finally {
                if (!published) release();
            }
        }).catch(() => undefined);
        return () => { disposed = true; ++generation; abort.abort(); disposeMounted?.(); };
    }, [trackRef]);
    return <span ref={host} className={styles.tyranidCanvas} data-pet-renderer="tyranid" aria-hidden="true"/>;
}
