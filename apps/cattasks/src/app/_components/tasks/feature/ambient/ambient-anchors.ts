export type AmbientRect = Readonly<{x: number; y: number; width: number; height: number}>;
export type AmbientGeometry = Readonly<{width: number; height: number; protectedRects: readonly AmbientRect[]; safeZones: readonly AmbientRect[]}>;

const selectors = [
    '[data-cattasks-workspace-content]', '[data-cattasks-header] h1', '[data-v146-task-number]',
    '[data-cattasks-header] button', "[aria-label='Task filters']", "[aria-labelledby='taskListTitle']",
    "[aria-labelledby='taskSolutionHeading']", "[aria-labelledby='taskOutputHeading']", '.monaco-editor',
    '#cattasks-theme-options', "[aria-controls='cattasks-theme-options']", "[aria-label='Pet feeding strip']", '[role=dialog]'
] as const;
const GUTTER = 12;
const MIN_WIDTH = 26;
const MIN_HEIGHT = 24;
const area = (rect: AmbientRect) => Math.max(0, rect.width) * Math.max(0, rect.height);
const valid = (rect: AmbientRect) => rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT;
const overlap = (a: AmbientRect, b: AmbientRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const expanded = (rect: AmbientRect, width: number, height: number): AmbientRect => ({x: Math.max(0, rect.x - GUTTER), y: Math.max(0, rect.y - GUTTER), width: Math.min(width, rect.x + rect.width + GUTTER) - Math.max(0, rect.x - GUTTER), height: Math.min(height, rect.y + rect.height + GUTTER) - Math.max(0, rect.y - GUTTER)});

function subtract(source: AmbientRect, cut: AmbientRect): AmbientRect[] {
    if (!overlap(source, cut)) return [source];
    const left = Math.max(source.x, cut.x), top = Math.max(source.y, cut.y);
    const right = Math.min(source.x + source.width, cut.x + cut.width), bottom = Math.min(source.y + source.height, cut.y + cut.height);
    return [{x: source.x, y: source.y, width: source.width, height: top - source.y}, {x: source.x, y: bottom, width: source.width, height: source.y + source.height - bottom}, {x: source.x, y: top, width: left - source.x, height: bottom - top}, {x: right, y: top, width: source.x + source.width - right, height: bottom - top}].filter(valid);
}
function localRect(element: Element, canvas: DOMRect, width: number, height: number): AmbientRect | null {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || !canvas.width || !canvas.height) return null;
    const scaleX = width / canvas.width, scaleY = height / canvas.height;
    const left = Math.max(0, (rect.left - canvas.left) * scaleX);
    const top = Math.max(0, (rect.top - canvas.top) * scaleY);
    const right = Math.min(width, (rect.right - canvas.left) * scaleX);
    const bottom = Math.min(height, (rect.bottom - canvas.top) * scaleY);
    return right > left && bottom > top ? {x: left, y: top, width: right - left, height: bottom - top} : null;
}
/** Measures DOM in a dirty pass and returns logical Pixi coordinates, never physical DPR pixels. */
export function measureAmbientGeometry(root: HTMLElement, canvas: HTMLCanvasElement, width: number, height: number): AmbientGeometry {
    const canvasRect = canvas.getBoundingClientRect();
    const protectedRects = [...new Set(selectors.flatMap(selector => [...root.querySelectorAll(selector)]))]
        .filter(element => {
            if (element.closest('[data-cattasks-ambient]')) return false;
            const style = getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map(element => localRect(element, canvasRect, width, height))
        .filter((rect): rect is AmbientRect => Boolean(rect));
    const bounds: AmbientRect = {x: 8, y: 8, width: Math.max(0, width - 16), height: Math.max(0, height - 16)};
    const safeZones = protectedRects.reduce<AmbientRect[]>((remaining, rect) => remaining.flatMap(zone => subtract(zone, expanded(rect, width, height))), [bounds]).sort((left, right) => area(right) - area(left)).slice(0, 8);
    return {width, height, protectedRects, safeZones};
}
