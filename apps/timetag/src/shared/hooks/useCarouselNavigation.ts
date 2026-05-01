'use client';

import React from 'react';

interface CarouselItem<TId extends string> {
  id: TId;
}

interface UseCarouselNavigationOptions<TId extends string> {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  items: readonly CarouselItem<TId>[];
  activeId: TId;
  onActiveChange: (id: TId) => void;
  isEnabled?: boolean;
  focusOnActiveChange?: boolean;
  scrollStep?: number;
}

export function useCarouselNavigation<TId extends string>({
  viewportRef,
  items,
  activeId,
  onActiveChange,
  isEnabled = true,
  focusOnActiveChange = true,
  scrollStep = 180,
}: UseCarouselNavigationOptions<TId>) {
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const focusRafRef = React.useRef<number | null>(null);

  const updateScrollState = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setHasOverflow(false);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setHasOverflow(maxScrollLeft > 4);
    setCanScrollLeft(viewport.scrollLeft > 4);
    setCanScrollRight(viewport.scrollLeft < maxScrollLeft - 4);
  }, [viewportRef]);

  const scrollByStep = React.useCallback((direction: 'left' | 'right') => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      left: direction === 'left' ? -scrollStep : scrollStep,
      behavior: 'smooth',
    });
  }, [scrollStep, viewportRef]);

  const focusItem = React.useCallback((id: TId, focus = true) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const target = viewport.querySelector<HTMLElement>(`[data-workspace-id="${id}"]`);
    if (!target) {
      return;
    }

    if (focus) {
      target.focus();
    }
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [viewportRef]);

  const scheduleFocusItem = React.useCallback((id: TId, focus = true) => {
    if (focusRafRef.current !== null) {
      window.cancelAnimationFrame(focusRafRef.current);
    }

    focusRafRef.current = window.requestAnimationFrame(() => {
      focusRafRef.current = null;
      focusItem(id, focus);
    });
  }, [focusItem]);

  React.useEffect(() => {
    return () => {
      if (focusRafRef.current !== null) {
        window.cancelAnimationFrame(focusRafRef.current);
        focusRafRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isEnabled) {
      return;
    }

    updateScrollState();
  }, [isEnabled, items.length, updateScrollState]);

  React.useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleResize = () => updateScrollState();
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateScrollState())
      : null;

    updateScrollState();
    viewport.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', handleResize);
    resizeObserver?.observe(viewport);

    return () => {
      viewport.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [isEnabled, updateScrollState, viewportRef]);

  React.useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      focusItem(activeId, focusOnActiveChange);
      updateScrollState();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [activeId, focusItem, focusOnActiveChange, isEnabled, updateScrollState]);

  const handleWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !hasOverflow) {
      return;
    }

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const newLeft = viewport.scrollLeft + event.deltaY;

    if ((newLeft <= 0 && event.deltaY < 0) || (newLeft >= maxScrollLeft && event.deltaY > 0)) {
      return;
    }

    const clampedLeft = Math.max(0, Math.min(newLeft, maxScrollLeft));

    event.preventDefault();
    viewport.scrollTo({ left: clampedLeft, behavior: 'auto' });
  }, [hasOverflow, viewportRef]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = items.findIndex((item) => item.id === activeId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const previousItem = items[Math.max(0, safeIndex - 1)];
      if (previousItem) {
        onActiveChange(previousItem.id);
        scheduleFocusItem(previousItem.id);
      }
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextItem = items[Math.min(items.length - 1, safeIndex + 1)];
      if (nextItem) {
        onActiveChange(nextItem.id);
        scheduleFocusItem(nextItem.id);
      }
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      const firstItem = items[0];
      if (firstItem) {
        onActiveChange(firstItem.id);
        scheduleFocusItem(firstItem.id);
      }
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const lastItem = items[items.length - 1];
      if (lastItem) {
        onActiveChange(lastItem.id);
        scheduleFocusItem(lastItem.id);
      }
      return;
    }

    if (event.key === 'PageUp') {
      event.preventDefault();
      scrollByStep('left');
      return;
    }

    if (event.key === 'PageDown') {
      event.preventDefault();
      scrollByStep('right');
    }
  }, [activeId, items, onActiveChange, scheduleFocusItem, scrollByStep]);

  return {
    hasOverflow,
    canScrollLeft,
    canScrollRight,
    updateScrollState,
    scrollByStep,
    focusItem,
    scheduleFocusItem,
    handleWheel,
    handleKeyDown,
  };
}

