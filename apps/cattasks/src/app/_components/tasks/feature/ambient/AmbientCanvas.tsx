'use client';

import {useEffect, useRef, useState} from 'react';
import type {Application, Container, Graphics} from 'pixi.js';
import type {CatTasksTheme} from '../../Browser TSX Components/taskDashboard/CatTasksTheme';
import {measureAmbientGeometry, protectedAmbientElements, type AmbientGeometry, type AmbientRect} from './ambient-anchors';

type Props = {theme: CatTasksTheme; motionEnabled: boolean};
type Pixi = typeof import('pixi.js');
type LightSpecies = 'butterfly' | 'bee' | 'dragonfly';
type Motif = {node: Container; wings?: readonly [Graphics, Graphics]; species?: LightSpecies; zone: AmbientRect; phase: number; halfWidth: number; halfHeight: number; originX: number; originY: number; pulsePeriod: number};
type DrawnMotif = Pick<Motif, 'node' | 'wings' | 'species' | 'halfWidth' | 'halfHeight'>;
const palette: Record<CatTasksTheme, readonly [number, number]> = {
    light: [0xffc35b, 0x8db7a2], dark: [0xf1d96f, 0x98ce72], khorne: [0xe66538, 0x922c24],
    nurgle: [0xb4d85e, 0x467a52], slaanesh: [0xeaa1dd, 0xc6c0ed], tzeentch: [0x76d8ff, 0xcd9bff],
};
const smoothstep = (value: number) => value * value * (3 - 2 * value);

function haze(pixi: Pixi, primary: number, secondary: number): Graphics {
    return new pixi.Graphics()
        .ellipse(0, 0, 26, 9).fill({color: secondary, alpha: .025})
        .ellipse(-4, 0, 19, 7).fill({color: primary, alpha: .045})
        .ellipse(2, -1, 12, 5).fill({color: primary, alpha: .075})
        .ellipse(5, -1, 6, 3).fill({color: secondary, alpha: .1});
}
function insect(pixi: Pixi, species: LightSpecies): DrawnMotif {
    const node = new pixi.Container();
    const left = new pixi.Graphics(), right = new pixi.Graphics(), body = new pixi.Graphics();
    if (species === 'butterfly') {
        left.ellipse(-8, 0, 9, 5).fill({color: 0xffc35b, alpha: .76}); right.ellipse(8, 0, 9, 5).fill({color: 0x8db7a2, alpha: .7}).circle(0, 0, 3).fill({color: 0x5a4635});
        body.roundRect(-2, -5, 4, 10, 2).fill({color: 0x5a4635});
    } else if (species === 'bee') {
        left.ellipse(-7, -6, 7, 3).fill({color: 0xeaf4f5, alpha: .68}); right.ellipse(7, -6, 7, 3).fill({color: 0xeaf4f5, alpha: .68});
        body.roundRect(-10, -4, 20, 8, 4).fill({color: 0xdc982c}).circle(-4, 0, 2).fill({color: 0x312820}).circle(4, 0, 2).fill({color: 0x312820});
    } else {
        left.poly([-13, 0, -2, -4, 2, 0, -2, 4]).fill({color: 0x8db7a2, alpha: .75}); right.ellipse(6, -5, 10, 2).fill({color: 0xebf8fb, alpha: .56});
        body.roundRect(-7, -2, 14, 4, 2).fill({color: 0x5f717a}).circle(-8, 0, 3).fill({color: 0x5f717a});
    }
    node.addChild(left, right, body);
    return {node, wings: [left, right], species, halfWidth: 16, halfHeight: 10};
}
function motif(pixi: Pixi, theme: CatTasksTheme, kind: number): DrawnMotif {
    const [primary, secondary] = palette[theme];
    if (theme === 'light') return insect(pixi, kind % 3 === 0 ? 'butterfly' : kind % 3 === 1 ? 'bee' : 'dragonfly');
    const node = new pixi.Container();
    const graphic = new pixi.Graphics();
    if (theme === 'dark') graphic.circle(0, 0, 14).fill({color: secondary, alpha: .025}).circle(0, 0, 9).fill({color: primary, alpha: .07}).circle(0, 0, 4).fill({color: primary, alpha: .92});
    else if (theme === 'nurgle' && kind % 3 === 0) node.addChild(haze(pixi, primary, secondary));
    else if (theme === 'nurgle') graphic.ellipse(0, 0, 5, 4).fill({color: 0x28362e}).ellipse(-8, -4, 8, 3).fill({color: 0xc8dfcb, alpha: .55}).ellipse(8, -4, 8, 3).fill({color: 0xc8dfcb, alpha: .55});
    else if (theme === 'khorne') graphic.poly([0, -10, 4, 5, 0, 10, -4, 5]).fill({color: primary, alpha: .84}).circle(0, 0, 12).fill({color: secondary, alpha: .04});
    else if (theme === 'slaanesh' && kind % 3 === 0) node.addChild(haze(pixi, primary, secondary));
    else if (theme === 'slaanesh') graphic.circle(0, 0, 10).fill({color: secondary, alpha: .03}).circle(0, 0, 6).fill({color: primary, alpha: .09}).circle(0, 0, 3).fill({color: primary, alpha: .75});
    else graphic.circle(0, 0, 12).fill({color: secondary, alpha: .035}).poly([-8, 0, 0, -8, 9, 0, 0, 8]).fill({color: primary, alpha: .76}).circle(0, 0, 11).stroke({color: secondary, width: 1, alpha: .42});
    node.addChild(graphic);
    return (theme === 'nurgle' || theme === 'slaanesh') && kind % 3 === 0
        ? {node, halfWidth: 26, halfHeight: 10}
        : theme === 'nurgle'
            ? {node, halfWidth: 14, halfHeight: 8}
            : theme === 'slaanesh'
                ? {node, halfWidth: 10, halfHeight: 10}
        : theme === 'dark' || theme === 'tzeentch'
            ? {node, halfWidth: 14, halfHeight: 14}
            : {node, halfWidth: 13, halfHeight: 13};
}
function clampNode(entry: Motif, x: number, y: number, angle = entry.node.rotation) {
    const cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle));
    const extentX = cosine * entry.halfWidth + sine * entry.halfHeight;
    const extentY = sine * entry.halfWidth + cosine * entry.halfHeight;
    const left = entry.zone.x + extentX, right = entry.zone.x + entry.zone.width - extentX;
    const top = entry.zone.y + extentY, bottom = entry.zone.y + entry.zone.height - extentY;
    entry.node.x = left <= right ? Math.max(left, Math.min(right, x)) : entry.zone.x + entry.zone.width / 2;
    entry.node.y = top <= bottom ? Math.max(top, Math.min(bottom, y)) : entry.zone.y + entry.zone.height / 2;
}
function populate(pixi: Pixi, scene: Container, geometry: AmbientGeometry, theme: CatTasksTheme): Motif[] {
    // Dirty rebuilds own every motif and its GraphicsContext.
    scene.removeChildren().forEach(child => child.destroy({children: true, context: true}));
    const narrow = geometry.width < 600;
    const count = theme === 'dark' ? (narrow ? 5 : 9) : theme === 'khorne' ? (narrow ? 5 : 10) : theme === 'light' ? (narrow ? 2 : 4) : narrow ? 2 : 5;
    const zones = geometry.safeZones.filter(zone => zone.width >= 12 && zone.height >= 12);
    if (!zones.length) return [];
    return Array.from({length: Math.min(count, zones.length * 2)}, (_, index) => {
        const zone = zones[index % zones.length], drawn = motif(pixi, theme, index);
        const scale = Math.min(1, zone.width / (drawn.halfWidth * 2), zone.height / (drawn.halfHeight * 2));
        drawn.node.scale.set(scale);
        const entry: Motif = {...drawn, zone, phase: index * 1.37, halfWidth: drawn.halfWidth * scale, halfHeight: drawn.halfHeight * scale, originX: 0, originY: 0, pulsePeriod: 4 + index % 4};
        const availableX = Math.max(0, zone.width - entry.halfWidth * 2), availableY = Math.max(0, zone.height - entry.halfHeight * 2);
        clampNode(entry, zone.x + entry.halfWidth + availableX * ((index * .61803398875) % 1), zone.y + entry.halfHeight + availableY * ((index * .38196601125) % 1));
        entry.originX = entry.node.x; entry.originY = entry.node.y;
        scene.addChild(entry.node);
        return entry;
    });
}

/** A dashboard-owned canvas with one private ticker callback and no pet ownership. */
export default function AmbientCanvas({theme, motionEnabled}: Props) {
    const host = useRef<HTMLDivElement>(null);
    const latest = useRef({theme, motionEnabled});
    const pixiRef = useRef<Pixi | null>(null);
    const appRef = useRef<Application | null>(null);
    const sceneRef = useRef<Container | null>(null);
    const tickRef = useRef<((ticker: {deltaMS: number}) => void) | null>(null);
    const geometry = useRef<AmbientGeometry | null>(null);
    const motifs = useRef<Motif[]>([]);
    const activeElapsed = useRef(0);
    const [ready, setReady] = useState(false);
    const [boundTheme, setBoundTheme] = useState<CatTasksTheme>();
    const [running, setRunning] = useState(false);
    latest.current = {theme, motionEnabled};

    useEffect(() => {
        const target = host.current, root = target?.parentElement;
        if (!target || !root) return;
        let disposed = false;
        void import('pixi.js').then(async pixi => {
            if (disposed || !target.isConnected) return;
            const app = new pixi.Application();
            try {
                await app.init({resizeTo: target, backgroundAlpha: 0, antialias: true, autoStart: false, preference: 'webgl'});
                if (disposed || !target.isConnected) { app.destroy(true); return; }
                app.ticker.remove(app.render, app);
                app.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
                target.appendChild(app.canvas); app.ticker.start();
                const scene = new pixi.Container(); app.stage.addChild(scene);
                pixiRef.current = pixi; appRef.current = app; sceneRef.current = scene; setReady(true);
            } catch {
                // A rejected renderer may not have created the Application
                // renderer at all; only dispose the locally constructed stage.
                if (app.renderer) app.destroy(true);
                else (app.stage as Container | undefined)?.destroy({children: true});
                if (!disposed) setRunning(false);
            }
        }).catch(() => {
            if (disposed) return;
            root.style.setProperty('--cattasks-ambient-pulse', '0');
            root.style.setProperty('--cattasks-ambient-pulse-a', '0');
            root.style.setProperty('--cattasks-ambient-pulse-b', '0');
            root.dataset.cattasksAmbientState = 'paused';
            setRunning(false);
        });
        return () => {
            disposed = true; setReady(false);
            const app = appRef.current; if (app && tickRef.current) app.ticker.remove(tickRef.current);
            tickRef.current = null; motifs.current = []; activeElapsed.current = 0; sceneRef.current?.destroy({children: true, context: true}); sceneRef.current = null; appRef.current = null; pixiRef.current = null;
            target.replaceChildren(); app?.destroy(true);
            root.style.setProperty('--cattasks-ambient-pulse', '0'); root.style.setProperty('--cattasks-ambient-pulse-a', '0'); root.style.setProperty('--cattasks-ambient-pulse-b', '0'); delete root.dataset.cattasksAmbientState;
        };
    }, []);

    useEffect(() => {
        const target = host.current, root = target?.parentElement, app = appRef.current, scene = sceneRef.current, pixi = pixiRef.current;
        if (!ready || !target || !root || !app || !scene || !pixi) return;
        let frame = 0, disposed = false;
        const observed = new Set<Element>();
        const syncProtectedObservers = (current: readonly Element[]) => {
            for (const element of observed) if (!current.includes(element)) { observer.unobserve(element); observed.delete(element); }
            for (const element of current) if (!observed.has(element)) { observer.observe(element); observed.add(element); }
        };
        const rebuild = () => {
            frame = 0;
            if (disposed || !target.isConnected || appRef.current !== app || sceneRef.current !== scene || pixiRef.current !== pixi) return;
            const elements = protectedAmbientElements(root);
            syncProtectedObservers(elements);
            geometry.current = measureAmbientGeometry(root, app.canvas, app.screen.width, app.screen.height, elements);
            if (disposed || !geometry.current) return;
            motifs.current = populate(pixi, scene, geometry.current, latest.current.theme);
            setBoundTheme(latest.current.theme); app.render();
        };
        const dirty = () => { if (!disposed && !frame) frame = requestAnimationFrame(rebuild); };
        const observer = new ResizeObserver(dirty);
        const changesLayout = (record: MutationRecord) => {
            const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target as Element : record.target.parentElement;
            return !target?.closest('.monaco-editor');
        };
        const mutations = new MutationObserver(records => {
            // Monaco text/decorations mutate for every keystroke but its outer
            // rectangle is already watched by ResizeObserver. Do not rebuild
            // a decorative scene for changes that remain wholly inside it.
            if (records.some(changesLayout)) dirty();
        });
        observer.observe(root);
        const fonts = document.fonts;
        const afterFonts = () => dirty();
        void fonts.ready.then(afterFonts).catch(() => undefined);
        fonts.addEventListener('loadingdone', afterFonts);
        mutations.observe(root, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'data-cattasks-theme', 'data-cattasks-page']});
        window.addEventListener('resize', dirty); window.addEventListener('scroll', dirty, {capture: true, passive: true}); dirty();
        return () => { disposed = true; if (frame) cancelAnimationFrame(frame); fonts.removeEventListener('loadingdone', afterFonts); observer.disconnect(); mutations.disconnect(); window.removeEventListener('resize', dirty); window.removeEventListener('scroll', dirty, true); };
    }, [ready, theme]);

    useEffect(() => {
        const app = appRef.current, root = host.current?.parentElement;
        if (!ready || !app || !root) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        const calm = () => {
            root.style.setProperty('--cattasks-ambient-pulse', '0'); root.style.setProperty('--cattasks-ambient-pulse-a', '0'); root.style.setProperty('--cattasks-ambient-pulse-b', '0');
            for (const entry of motifs.current) { entry.node.alpha = 1; entry.wings?.forEach(wing => { wing.scale.y = 1; }); }
        };
        const pause = () => { if (tickRef.current) app.ticker.remove(tickRef.current); tickRef.current = null; calm(); root.dataset.cattasksAmbientState = 'paused'; setRunning(false); app.render(); };
        const sync = () => {
            if (!latest.current.motionEnabled || reduced.matches || document.hidden) return pause();
            if (tickRef.current) return;
            const tick = (ticker: {deltaMS: number}) => {
                const dt = Math.min(50, Math.max(0, ticker.deltaMS)) / 1000;
                const elapsed = activeElapsed.current += dt;
                const activeTheme = latest.current.theme;
                for (const entry of motifs.current) {
                    const speed = activeTheme === 'light' ? 8 : activeTheme === 'nurgle' ? 3 : activeTheme === 'khorne' ? 9 : 6;
                    let nextX = entry.node.x + Math.sin(elapsed + entry.phase) * speed * dt;
                    let nextY = entry.node.y + Math.cos(elapsed * .8 + entry.phase) * speed * dt;
                    const rotation = Math.sin(elapsed * 1.2 + entry.phase) * .12;
                    if (entry.species === 'butterfly') {
                        nextX = entry.originX + Math.sin(elapsed * .78 + entry.phase) * Math.max(3, entry.zone.width * .17);
                        nextY = entry.originY + Math.cos(elapsed * .63 + entry.phase) * Math.max(2, entry.zone.height * .08) + Math.sin(elapsed * 1.56 + entry.phase) * 2;
                    } else if (entry.species === 'bee') {
                        const cadence = 1.2, local = (elapsed + entry.phase) % cadence, hop = Math.floor((elapsed + entry.phase) / cadence);
                        const point = (index: number) => ({x: entry.originX + Math.sin(index * 1.71 + entry.phase) * Math.max(3, entry.zone.width * .15), y: entry.originY + Math.cos(index * 1.19 + entry.phase) * Math.max(2, entry.zone.height * .07)});
                        const current = point(hop), next = point(hop + 1), move = local > .75 ? smoothstep((local - .75) / .45) : 0;
                        nextX = current.x + (next.x - current.x) * move;
                        nextY = current.y + (next.y - current.y) * move;
                    } else if (entry.species === 'dragonfly') {
                        const cadence = 1.45, local = (elapsed + entry.phase) % cadence, hop = Math.floor((elapsed + entry.phase) / cadence);
                        const point = (index: number) => ({x: entry.originX + Math.sin(index * 1.37 + entry.phase) * Math.max(4, entry.zone.width * .24), y: entry.originY + Math.cos(index * .71 + entry.phase) * Math.max(1.5, entry.zone.height * .035)});
                        const current = point(hop), next = point(hop + 1), glide = local < 1.1 ? smoothstep(local / 1.1) : 1;
                        nextX = current.x + (next.x - current.x) * glide;
                        nextY = current.y + (next.y - current.y) * glide;
                    }
                    if (activeTheme === 'khorne') {
                        nextY -= speed * .55 * dt;
                        const upper = entry.zone.y + entry.halfHeight;
                        if (nextY < upper) nextY = entry.zone.y + entry.zone.height - entry.halfHeight;
                    }
                    entry.node.rotation = rotation; clampNode(entry, nextX, nextY, rotation);
                    if (entry.wings) {
                        const rate = entry.species === 'butterfly' ? 7 : entry.species === 'bee' ? 18 : 24;
                        const beat = .56 + (Math.sin(elapsed * rate + entry.phase) + 1) * .21;
                        entry.wings[0].scale.y = beat; entry.wings[1].scale.y = 1.34 - beat;
                    }
                    if (activeTheme === 'dark') entry.node.alpha = .54 + (Math.sin((elapsed / entry.pulsePeriod) * Math.PI * 2 + entry.phase) + 1) * .23;
                }
                root.style.setProperty('--cattasks-ambient-pulse', (.05 + (Math.sin(elapsed * .92) + 1) * .045).toFixed(3));
                root.style.setProperty('--cattasks-ambient-pulse-a', (.035 + (Math.sin(elapsed * .92) + 1) * .035).toFixed(3));
                root.style.setProperty('--cattasks-ambient-pulse-b', (.035 + (Math.sin(elapsed * .92 + 2.1) + 1) * .035).toFixed(3));
                app.render();
            };
            tickRef.current = tick; app.ticker.add(tick); root.dataset.cattasksAmbientState = 'running'; setRunning(true);
        };
        reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync); sync();
        return () => { reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); if (tickRef.current) app.ticker.remove(tickRef.current); tickRef.current = null; };
    }, [ready, motionEnabled, theme]);

    return <div ref={host} data-cattasks-ambient="" data-ambient-state={running ? 'running' : 'paused'} data-ambient-theme={boundTheme} aria-hidden="true" style={{position: 'fixed', zIndex: 1, inset: 0, pointerEvents: 'none', overflow: 'hidden'}}/>;
}
