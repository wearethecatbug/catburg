'use client';
import {type RefObject, useEffect, useRef, useState} from 'react';

export type ViewportBounds = {
    left: number; top: number; right: number; bottom: number;
    width: number; height: number;
};

export function useViewportBounds<T extends HTMLElement = HTMLDivElement>(
    padding: number = 0,
    targetRef?: RefObject<T | null>
) {
    const ownContainerRef = useRef<T | null>(null);
    const [viewportBounds, setViewportBounds] = useState<ViewportBounds>({
        left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0,
    });

    useEffect(() => {
        const element = (targetRef?.current ?? ownContainerRef.current);
        if (!element) return;

        const compute = () => {
            const width = element.clientWidth, height = element.clientHeight;
            setViewportBounds({
                left: padding,
                top: padding,
                right: Math.max(0, width - padding),
                bottom: Math.max(0, height - padding),
                width, height,
            });
        };

        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(element);
        return () => ro.disconnect();
    }, [padding, targetRef]);

    return targetRef
        ? {viewportBounds}
        : {containerRef: ownContainerRef as RefObject<HTMLDivElement | null>, viewportBounds};
}