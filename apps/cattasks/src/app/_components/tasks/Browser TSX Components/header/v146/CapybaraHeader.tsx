'use client';

import {useLayoutEffect, useRef} from 'react';
import type {CSSProperties, RefObject} from 'react';
import {useTaskContext} from '../../../context/TaskProvider';
import styles from './CapybaraHeader.module.css';
import {getCapybaraLayout} from './capybara-layout';

type Props = { readonly className?: string; readonly isAllTasksOpen: boolean; readonly onAllTasks: () => void; readonly onBack: () => void; readonly allTasksButtonRef: RefObject<HTMLButtonElement | null>; readonly workspaceWidth: number; };

const px = (value: number) => `${value}px`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type ArtName = 'fox' | 'study' | 'nook' | 'rabbit' | 'catalogCapybara' | 'leaves' | 'samoyed' | 'yarn';

export default function CapybaraHeader({className, isAllTasksOpen, onAllTasks, onBack, allTasksButtonRef, workspaceWidth}: Props) {
    const {tasks, catalogError, selectedTask, selectPreviousTask, selectNextTask} = useTaskContext();
    const hasTasks = tasks.length > 0;
    const index = selectedTask ? tasks.findIndex(task => task.id === selectedTask.id) : -1;
    const previousDisabled = index <= 0;
    const nextDisabled = !hasTasks || index >= tasks.length - 1;
    const title = isAllTasksOpen ? 'All tasks' : selectedTask?.title ?? (catalogError ? 'Tasks unavailable.' : hasTasks ? 'No task selected.' : 'Loading tasks…');
    const layout = getCapybaraLayout(workspaceWidth);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const preferredTitleSize = clamp(layout.width * .01875, 16, 30);
    const titleBoxWidth = layout.title[2];
    const titleBoxHeight = layout.title[3];

    useLayoutEffect(() => {
        const heading = titleRef.current;
        if (!heading) return undefined;
        let disposed = false;
        let frame = 0;

        const measure = () => {
            if (disposed) return;
            const previous = heading.style.cssText;
            heading.style.setProperty('display', 'block');
            heading.style.setProperty('-webkit-line-clamp', 'unset');
            heading.style.setProperty('overflow', 'visible');
            const range = document.createRange();
            range.selectNodeContents(heading);
            let size = preferredTitleSize;
            while (size > 16) {
                heading.style.fontSize = px(size);
                const box = heading.getBoundingClientRect();
                const glyphRects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
                const rowTops = glyphRects.reduce<number[]>((tops, rect) => (
                    tops.some(top => Math.abs(top - rect.top) <= 2) ? tops : [...tops, rect.top]
                ), []);
                const glyphsFit = glyphRects.length > 0 && rowTops.length <= 2 && glyphRects.every(rect => (
                    rect.left >= box.left - 1
                    && rect.right <= box.right + 1
                    && rect.top >= box.top - 1
                    && rect.bottom <= box.bottom + 1
                ));
                if (heading.scrollHeight <= titleBoxHeight + 1 && glyphsFit) break;
                size = Math.max(16, size - .25);
            }
            heading.style.cssText = previous;
            if (!disposed) heading.style.setProperty('--capy-title-fit-size', px(size));
        };

        frame = requestAnimationFrame(measure);
        void document.fonts?.ready.then(() => {
            if (disposed) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        });
        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
        };
    }, [preferredTitleSize, title, titleBoxHeight, titleBoxWidth]);
    const css = {
        '--capy-header-height': px(layout.height),
        '--capy-baseline': px(layout.baseline),
        '--capy-shelf-top': px(layout.shelfTop),
        '--capy-shelf-height': px(layout.shelfHeight),
        '--capy-shelf-inset': px(layout.inset),
        '--capy-control-font-size': px(clamp(layout.width * .01125, 12, 18)),
        '--capy-title-font-size': px(preferredTitleSize),
        '--capy-nav-font-size': px(clamp(layout.width * .02, 20, 32)),
        '--capy-pose-width': px(layout.poseWidth),
        '--capy-pose-height': px(layout.poseHeight),
        '--capy-pose-anchor': px(layout.poseAnchor),
        '--capy-pose-foot': px(layout.poseFoot),
    } as CSSProperties;
    const placed = (rect: readonly number[]) => ({left: px(rect[0]), top: px(rect[1]), width: px(rect[2]), height: px(rect[3])});
    const art = (name: ArtName, rect: readonly number[] | undefined) => {
        if (!rect) return null;
        if (name === 'study' || name === 'nook') {
            const vignetteClass = name === 'study' ? styles.study : styles.nook;
            return <span className={`${styles.vignette} ${vignetteClass}`} aria-hidden="true" style={placed(rect)}><span className={styles.vignetteImage}/></span>;
        }
        return <span className={`${styles.art} ${styles[name]}`} aria-hidden="true" style={placed(rect)}/>;
    };
    const contact = (name: string, rect: readonly number[] | undefined) => {
        if (!rect) return null;
        const contactRect = name === 'fox'
            ? [rect[0] + 150 * layout.foxScale, layout.shelfTop - 1, 340 * layout.foxScale, layout.compact ? 3 : 4]
            : [rect[0] + rect[2] * .13, rect[1] + rect[3] - 3, rect[2] * .74, layout.compact ? 4 : 6];
        return <span className={styles.contact} aria-hidden="true" style={placed(contactRect)}/>;
    };
    const backLabel = isAllTasksOpen ? 'Back to task' : 'All tasks';
    return <header className={`${styles.header} ${className ?? ''}`} style={css} data-cattasks-header="capybara" data-capybara-compact={layout.compact}>
        <div className={styles.shelf} aria-hidden="true"><span className={styles.bracketLeft} style={{width: px(layout.bracketWidth)}}/><span className={styles.bracketRight} style={{width: px(layout.bracketWidth)}}/></div>
        <button ref={allTasksButtonRef} type="button" className={styles.back} style={placed(layout.back)} onClick={isAllTasksOpen ? onBack : onAllTasks} aria-label={backLabel}><span aria-hidden="true">←</span><span>{layout.back[2] < 120 ? (isAllTasksOpen ? 'Back' : layout.back[2] < 85 ? 'Tasks' : 'All tasks') : backLabel}</span></button>
        <p className={styles.number} style={placed(layout.number)} hidden={isAllTasksOpen}>Task {String(selectedTask?.ordinal ?? 1).padStart(2, '0')}</p>
        <h1 ref={titleRef} className={styles.title} style={placed(layout.title)} title={title}>{title}</h1>
        {!isAllTasksOpen && <>
            <div className={styles.nav} style={placed(layout.previous)}>{layout.mascot && <span className={`${styles.mascot} ${styles.mascotPrevious}`} aria-hidden="true"><span className={styles.poseNormal}/><span className={styles.poseReveal}/></span>}<button type="button" aria-label="Select previous task" disabled={previousDisabled} onClick={selectPreviousTask}>←</button></div>
            <div className={styles.nav} style={placed(layout.next)}><span className={styles.mascot} aria-hidden="true"><span className={styles.poseNormal}/><span className={styles.poseReveal}/></span><button type="button" aria-label="Select next task" disabled={nextDisabled} onClick={selectNextTask}>→</button></div>
        </>}
        {!isAllTasksOpen && <>{art('fox',layout.task.fox)}{contact('fox',layout.task.fox)}{art('study',layout.task.study)}{contact('study',layout.task.study)}{art('nook',layout.task.nook)}{contact('nook',layout.task.nook)}{layout.task.study && <><span className={styles.lanternGlow} aria-hidden="true" style={placed([layout.task.study[0] + layout.task.study[2] * .48, layout.task.study[1] - 3, layout.task.study[2] * .72, layout.task.study[3] + 12])}/><span className={styles.warmPool} aria-hidden="true" style={placed([layout.task.study[0] + layout.task.study[2] * .48, layout.task.study[1] + layout.task.study[3] - 5, layout.task.study[2] * .72, 10])}/></>}</>}
        {isAllTasksOpen && <>{art('rabbit',layout.catalog.rabbit)}{contact('rabbit',layout.catalog.rabbit)}{art('catalogCapybara',layout.catalog.capybara)}{contact('capybara',layout.catalog.capybara)}{art('leaves',layout.catalog.leaves)}{art('samoyed',layout.catalog.samoyed)}{contact('samoyed',layout.catalog.samoyed)}{art('yarn',layout.catalog.yarn)}{contact('yarn',layout.catalog.yarn)}</>}
    </header>;
}
