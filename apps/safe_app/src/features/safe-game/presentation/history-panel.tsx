"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import styles from "./history-panel.module.css";

type Point = { left: number; top: number };
type Rect = { bottom: number; left: number; right: number; top: number };

type LaneRefs = {
  characterEffectZoneRef: RefObject<HTMLDivElement | null>;
  headerZoneRef: RefObject<HTMLElement | null>;
  panelLaneRef: RefObject<HTMLDivElement | null>;
};

function getOffsetParentRect(panel: HTMLDivElement) {
  const offsetParent = panel.offsetParent;
  return offsetParent instanceof HTMLElement
    ? offsetParent.getBoundingClientRect()
    : document.documentElement.getBoundingClientRect();
}

function activeEffectExclusion(
  characterEffectZone: HTMLDivElement | null,
): Rect | null {
  if (!characterEffectZone) return null;
  const candidate = [...characterEffectZone.querySelectorAll<HTMLElement>(
    '[role="img"][aria-label="New hint reward"], :scope [data-presentation-mode] > span',
  )].find(
    (element) =>
      element.textContent?.trim() === "Pet me" ||
      element.getAttribute("aria-label") === "New hint reward",
  );
  if (!candidate?.isConnected) return null;
  const rect = candidate.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function laneBounds(laneRefs: LaneRefs): Rect | null {
  const lane = laneRefs.panelLaneRef.current;
  if (!lane) return null;
  const laneRect = lane.getBoundingClientRect();
  const headerBottom = laneRefs.headerZoneRef.current?.getBoundingClientRect().bottom ?? 0;
  let top = Math.max(laneRect.top + 8, headerBottom + 8);
  const exclusion = activeEffectExclusion(laneRefs.characterEffectZoneRef.current);
  if (
    exclusion &&
    exclusion.left < laneRect.right - 8 &&
    exclusion.right > laneRect.left + 8
  ) {
    top = Math.max(top, exclusion.bottom + 8);
  }
  return {
    bottom: laneRect.bottom,
    left: laneRect.left + 8,
    right: laneRect.right - 8,
    top,
  };
}

function clamp(point: Point, panel: HTMLDivElement, laneRefs: LaneRefs) {
  // CSS offsets are relative to the containing block, while bounds remain viewport-relative.
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const parentRect = getOffsetParentRect(panel);
  const bounds = laneBounds(laneRefs);
  if (!bounds) return point;
  return {
    left: Math.max(
      bounds.left - parentRect.left,
      Math.min(
        point.left,
        bounds.right - width - parentRect.left,
      ),
    ),
    top: Math.max(
      bounds.top - parentRect.top,
      Math.min(
        point.top,
        bounds.bottom - height - parentRect.top,
      ),
    ),
  };
}

export function HistoryPanel({
  attempts,
  anchorRef,
  characterEffectZoneRef,
  headerZoneRef,
  panelLaneRef,
  onClose,
  onActivity,
}: {
  attempts: number[];
  anchorRef: RefObject<HTMLButtonElement | null>;
  characterEffectZoneRef: RefObject<HTMLDivElement | null>;
  headerZoneRef: RefObject<HTMLElement | null>;
  panelLaneRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onActivity: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  const activityFrameRef = useRef<number | null>(null);
  const revealFrameRef = useRef<number | null>(null);
  const revealIncludesAnchorRef = useRef(false);
  const initialRevealExecutedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    origin: Point;
    start: Point;
  } | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const laneRefs = useMemo(
    () => ({ characterEffectZoneRef, headerZoneRef, panelLaneRef }),
    [characterEffectZoneRef, headerZoneRef, panelLaneRef],
  );

  const anchoredPosition = useCallback(() => {
    // Initial placement follows the button in document space; later movement and resize stay
    // panel-lane-clamped.
    const panel = panelRef.current;
    const parentRect = panel
      ? getOffsetParentRect(panel)
      : document.documentElement.getBoundingClientRect();
    const buttonRect = anchorRef.current?.getBoundingClientRect();
    return {
      left: (buttonRect?.left ?? parentRect.left + 12) - parentRect.left,
      top: (buttonRect?.bottom ?? parentRect.top + 4) - parentRect.top + 8,
    };
  }, [anchorRef]);

  const scheduleVisibilityReconciliation = useCallback((includeAnchor: boolean) => {
    revealIncludesAnchorRef.current ||= includeAnchor;
    if (revealFrameRef.current !== null) return;
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = null;
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel?.isConnected || !anchor?.isConnected) return;
      const panelRect = panel.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const revealAnchor = revealIncludesAnchorRef.current;
      revealIncludesAnchorRef.current = false;
      const nearestOffset = (start: number, end: number, viewportSize: number) => {
        if (start < 0) return start;
        if (end > viewportSize) return end - viewportSize;
        return 0;
      };
      const combinedWidth = Math.max(panelRect.right, anchorRect.right) - Math.min(panelRect.left, anchorRect.left);
      const combinedHeight = Math.max(panelRect.bottom, anchorRect.bottom) - Math.min(panelRect.top, anchorRect.top);
      const revealBoth =
        revealAnchor &&
        combinedWidth <= window.innerWidth &&
        combinedHeight <= window.innerHeight;
      const left = nearestOffset(
        revealBoth ? Math.min(panelRect.left, anchorRect.left) : panelRect.left,
        revealBoth ? Math.max(panelRect.right, anchorRect.right) : panelRect.right,
        window.innerWidth,
      );
      const top = nearestOffset(
        revealBoth ? Math.min(panelRect.top, anchorRect.top) : panelRect.top,
        revealBoth ? Math.max(panelRect.bottom, anchorRect.bottom) : panelRect.bottom,
        window.innerHeight,
      );
      if (left !== 0 || top !== 0) window.scrollBy({ left, top });
      if (revealAnchor) initialRevealExecutedRef.current = true;
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    setPosition(panel ? clamp(anchoredPosition(), panel, laneRefs) : anchoredPosition());
    dragHandleRef.current?.focus({ preventScroll: true });
  }, [anchoredPosition, laneRefs]);
  useEffect(
    () => () => {
      if (activityFrameRef.current !== null) cancelAnimationFrame(activityFrameRef.current);
      if (revealFrameRef.current !== null) {
        cancelAnimationFrame(revealFrameRef.current);
        revealFrameRef.current = null;
      }
      revealIncludesAnchorRef.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!position) return;
    if (!initialRevealExecutedRef.current) {
      scheduleVisibilityReconciliation(true);
    } else if (!dragRef.current) {
      scheduleVisibilityReconciliation(false);
    }
  }, [position, scheduleVisibilityReconciliation]);
  useEffect(() => {
    const onResize = () => {
      if (panelRef.current && position)
        setPosition(clamp(position, panelRef.current, laneRefs));
      scheduleVisibilityReconciliation(!initialRevealExecutedRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [laneRefs, position, scheduleVisibilityReconciliation]);

  function move(next: Point) {
    if (panelRef.current) setPosition(clamp(next, panelRef.current, laneRefs));
  }

  function scheduleActivity() {
    if (activityFrameRef.current !== null) return;
    activityFrameRef.current = requestAnimationFrame(() => {
      activityFrameRef.current = null;
      onActivity();
    });
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!panelRef.current) return;
    const start = position ?? anchoredPosition();
    dragRef.current = {
      pointerId: event.pointerId,
      origin: { left: event.clientX, top: event.clientY },
      start,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    scheduleActivity();
    move({
      left: drag.start.left + event.clientX - drag.origin.left,
      top: drag.start.top + event.clientY - drag.origin.top,
    });
  }

  function endPointer(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (activityFrameRef.current !== null) {
      cancelAnimationFrame(activityFrameRef.current);
      activityFrameRef.current = null;
    }
    scheduleVisibilityReconciliation(!initialRevealExecutedRef.current);
  }

  function onMoveKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      anchorRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!panelRef.current) return;
    if (event.key === "Home") {
      event.preventDefault();
      const panel = panelRef.current;
      setPosition(panel ? clamp(anchoredPosition(), panel, laneRefs) : anchoredPosition());
      scheduleVisibilityReconciliation(!initialRevealExecutedRef.current);
      return;
    }
    const amount = event.shiftKey ? 1 : 10;
    const offsets: Record<string, Point> = {
      ArrowLeft: { left: -amount, top: 0 },
      ArrowRight: { left: amount, top: 0 },
      ArrowUp: { left: 0, top: -amount },
      ArrowDown: { left: 0, top: amount },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const current = position ?? anchoredPosition();
    onActivity();
    move({ left: current.left + offset.left, top: current.top + offset.top });
    scheduleVisibilityReconciliation(!initialRevealExecutedRef.current);
  }

  return (
    <section
      ref={panelRef}
      className={styles.logViewContainer}
      style={position ? { left: position.left, top: position.top } : undefined}
      aria-label="History"
    >
      <button
        ref={dragHandleRef}
        className={styles.dragHandle}
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={onMoveKeyDown}
      >
        Move History
      </button>
      <h2>History</h2>
      <div className={styles.entries} aria-live="polite">
        {attempts.length === 0 ? (
          <p>No valid attempts yet.</p>
        ) : (
          <ol>
            {attempts.map((attempt) => (
              <li key={attempt}>{attempt}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
