'use client';

import {useLayoutEffect, useMemo, useRef, type CSSProperties, type RefObject} from 'react';
import {getWorkspaceHeaderLayouts} from './pure/workspace/header-placement.mjs';
import {renderHeaderArtwork, resolveHeaderAsset} from './header-artwork';
import {getIndustrialTaskTextLayout} from './themed-layout';

export type V146Construction = 'industrial' | 'gothic' | 'armor';
export type V146Theme = 'khorne' | 'nurgle';

type Props = {
    readonly width: number;
    readonly construction: V146Construction;
    readonly theme: V146Theme;
    readonly mode: 'task' | 'catalogue';
    readonly title: string;
    readonly taskNumber?: number;
    readonly onBack: () => void;
    readonly onPrevious?: () => void;
    readonly onNext?: () => void;
    readonly previousDisabled?: boolean;
    readonly nextDisabled?: boolean;
    readonly backButtonRef?: RefObject<HTMLButtonElement | null>;
};

type Rect = readonly [number, number, number, number];
const rectStyle = (rect: Rect, offset: number): CSSProperties => ({position: 'absolute', left: rect[0], top: rect[1] + offset, width: rect[2], height: rect[3]});
const supportRailStyle = (asset: string): CSSProperties => ({
    position: 'absolute', zIndex: -1, top: 'calc(var(--workspace-header-slot, 0px) - 15px)', right: 0, left: 0, height: 15, pointerEvents: 'none',
    border: '1px solid rgb(183 151 92 / .46)', borderRadius: '3px 3px 0 0',
    background: `linear-gradient(180deg, rgb(244 215 149 / .1), rgb(0 0 0 / .27)), url(${asset}) center 50% / calc(100% + 32px) 1053% no-repeat, #231e16`,
    boxShadow: 'inset 0 1px rgb(255 237 177 / .32), inset 0 -3px rgb(0 0 0 / .56), 0 -1px 4px rgb(0 0 0 / .38)'
});
/** Decorative SVG receives only enum/numeric data. All user-visible text stays React text. */
export default function V146Header(props: Props) {
    const titleRef = useRef<HTMLHeadingElement>(null);
    const titleBoxRef = useRef<HTMLDivElement>(null);
    const pair = useMemo(() => getWorkspaceHeaderLayouts(props.width || 320, {style: props.construction, theme: props.theme}), [props.width, props.construction, props.theme]);
    const layout = props.mode === 'task' ? pair.task : pair.catalog;
    const offset = props.mode === 'task' ? pair.offsets.task : pair.offsets.catalog;
    const industrialTaskText = useMemo(() => props.mode === 'task' && props.construction === 'industrial'
        ? getIndustrialTaskTextLayout(props.width || 320, props.title, props.taskNumber ?? 0, props.theme)
        : undefined, [props.mode, props.construction, props.width, props.title, props.taskNumber, props.theme]);
    const artwork = useMemo(() => renderHeaderArtwork(layout, props.theme), [layout, props.theme]);
    const supportRail = useMemo(() => supportRailStyle(resolveHeaderAsset('industrial/panel-strip-metal.png')), []);
    const rects = layout.rects as Record<string, Rect | undefined>;
    const hits = layout.hits as Record<string, Rect | undefined>;
    const labels = layout.labels as Record<string, {rect: Rect; fontSize: number} | undefined>;
    const previous = hits.previous ?? rects.previous;
    const next = hits.next ?? rects.next;
    const back = hits.back ?? rects.back;
    const titleRect = industrialTaskText?.title.rect ?? labels.title?.rect ?? rects.title;
    const numberRect = industrialTaskText?.number?.rect ?? labels.number?.rect;
    const titleFontSize = industrialTaskText?.title.fontSize ?? labels.title?.fontSize ?? 22;
    const titleLineHeight = industrialTaskText && titleFontSize > 0
        ? industrialTaskText.title.lineHeight / titleFontSize
        : 1;
    const titlePhysicalAllowance = titleRect && numberRect
        ? Math.min(3, Math.max(0, titleRect[1] - numberRect[1] - numberRect[3]) * 2)
        : 0;

    useLayoutEffect(() => {
        const heading = titleRef.current;
        const box = titleBoxRef.current;
        if (!heading || !box || props.mode !== 'task') return;

        let frame = 0;
        let disposed = false;
        const minimumFontSize = 18;
        const clearTitleFit = () => {
            heading.style.removeProperty('--header-title-fitted-size');
            heading.style.removeProperty('max-block-size');
            heading.style.removeProperty('overflow');
            delete heading.dataset.titleTruncated;
        };
        const fitTitle = () => {
            if (disposed) return;
            clearTitleFit();
            const preferredFontSize = Math.max(minimumFontSize, Number.parseFloat(getComputedStyle(heading).fontSize));
            const physicalTitleHeight = box.clientHeight + titlePhysicalAllowance;
            const fitsInTwoLines = () => {
                const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);
                return Number.isFinite(lineHeight)
                    && heading.scrollHeight <= lineHeight * 2 + 1
                    && heading.scrollHeight <= physicalTitleHeight;
            };
            if (fitsInTwoLines()) return;
            for (let size = preferredFontSize - .5; size >= minimumFontSize; size -= .5) {
                heading.style.setProperty('--header-title-fitted-size', `${size}px`);
                if (fitsInTwoLines()) return;
            }
            heading.style.setProperty('--header-title-fitted-size', `${minimumFontSize}px`);
            heading.dataset.titleTruncated = 'true';
            heading.style.setProperty('max-block-size', `${physicalTitleHeight}px`);
            heading.style.setProperty('overflow', 'hidden');
        };
        const scheduleFit = () => {
            if (disposed) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(fitTitle);
        };
        const observer = new ResizeObserver(scheduleFit);
        observer.observe(box);
        fitTitle();
        void document.fonts?.ready.then(scheduleFit);
        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            clearTitleFit();
        };
    }, [props.mode, props.title, titleFontSize, titlePhysicalAllowance]);
    return <header data-v146-header="" data-cattasks-header="" data-khorne-header={props.mode === 'catalogue' ? 'catalogue' : 'task'} data-warhammer-variant={props.theme} data-v146-construction={props.construction} data-v146-mode={props.mode} style={{position: 'relative', isolation: 'isolate', width: '100%', height: pair.baseline, overflow: 'visible'}}>
        <div data-cattasks-decoration="" aria-hidden="true" style={{position: 'absolute', inset: 0, pointerEvents: 'none', transform: `translateY(${offset}px)`}} dangerouslySetInnerHTML={{__html: artwork}}/>
        <span data-khorne-rail="" data-warhammer-variant={props.theme} aria-hidden="true" style={supportRail}/>
        {back && <button ref={props.backButtonRef} type="button" aria-label={props.mode === 'task' ? 'All tasks' : 'Back to task'} onClick={props.onBack} style={{...rectStyle(back, offset), ...(props.mode === 'catalogue' ? {zIndex: 1} : {})}}>{props.mode === 'task' ? 'All tasks' : 'Back to task'}</button>}
        {props.mode === 'task' && previous && <button type="button" aria-label="Select previous task" disabled={props.previousDisabled} aria-disabled={props.previousDisabled} onClick={props.onPrevious} style={rectStyle(previous, offset)}>‹</button>}
        {props.mode === 'task' && next && <button type="button" aria-label="Select next task" disabled={props.nextDisabled} aria-disabled={props.nextDisabled} onClick={props.onNext} style={rectStyle(next, offset)}>›</button>}
        {titleRect && <div ref={titleBoxRef} style={rectStyle(titleRect, offset)}><h1 ref={titleRef} title={props.mode === 'task' ? props.title : undefined} style={{position: 'absolute', top: '50%', right: 0, left: 0, transform: 'translateY(-50%)', margin: 0, textAlign: 'center', inlineSize: '100%', fontSize: `var(--header-title-fitted-size, ${titleFontSize}px)`, lineHeight: titleLineHeight, overflowWrap: 'anywhere'}}>{props.mode === 'task' ? props.title : 'All tasks'}</h1></div>}
        {props.mode === 'task' && numberRect && <span aria-hidden="true" style={{...rectStyle(numberRect, offset), display: 'grid', placeItems: 'center'}}>TASK {String(props.taskNumber ?? 0).padStart(2, '0')}</span>}
    </header>;
}
