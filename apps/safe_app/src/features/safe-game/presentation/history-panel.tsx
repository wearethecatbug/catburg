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
  anchorRef: RefObject<HTMLButtonElement | null>;
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

function renderedScale(panel: HTMLDivElement) {
  const offsetParent = panel.offsetParent;
  if (!(offsetParent instanceof HTMLElement)) return { x: 1, y: 1 };
  const rect = offsetParent.getBoundingClientRect();
  return {
    x: rect.width / offsetParent.offsetWidth || 1,
    y: rect.height / offsetParent.offsetHeight || 1,
  };
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
  let top = Math.max(8, laneRect.top + 8, headerBottom + 8);
  const exclusion = activeEffectExclusion(laneRefs.characterEffectZoneRef.current);
  if (
    exclusion &&
    exclusion.left < laneRect.right - 8 &&
    exclusion.right > laneRect.left + 8
  ) {
    top = Math.max(top, exclusion.bottom + 8);
  }
  return {
    bottom: Math.min(window.innerHeight - 8, laneRect.bottom),
    left: Math.max(8, laneRect.left + 8),
    right: Math.min(
      window.innerWidth - 8,
      Math.max(
        laneRect.right - 8,
        laneRefs.anchorRef.current?.getBoundingClientRect().right ?? 0,
      ),
    ),
    top,
  };
}

function clamp(point: Point, panel: HTMLDivElement, laneRefs: LaneRefs) {
  // CSS offsets are unscaled; rendered bounds are viewport-relative.
  const rect = panel.getBoundingClientRect();
  const scale = renderedScale(panel);
  const parentRect = getOffsetParentRect(panel);
  const bounds = laneBounds(laneRefs);
  if (!bounds) return point;
  const minLeft = (bounds.left - parentRect.left) / scale.x;
  const maxLeft = (bounds.right - parentRect.left - rect.width) / scale.x;
  const minTop = (bounds.top - parentRect.top) / scale.y;
  const maxTop = (bounds.bottom - parentRect.top - rect.height) / scale.y;
  return {
    left: Math.max(minLeft, Math.min(point.left, Math.max(minLeft, maxLeft))),
    top: Math.max(minTop, Math.min(point.top, Math.max(minTop, maxTop))),
  };
}

export function HistoryPanel({
  attempts,
  anchorRef,
  characterEffectZoneRef,
  headerZoneRef,
  panelLaneRef,
  externalPanelRef,
  covered = false,
  onClose,
  onActivity,
}: {
  attempts: number[];
  anchorRef: RefObject<HTMLButtonElement | null>;
  characterEffectZoneRef: RefObject<HTMLDivElement | null>;
  headerZoneRef: RefObject<HTMLElement | null>;
  panelLaneRef: RefObject<HTMLDivElement | null>;
  externalPanelRef?: RefObject<HTMLDivElement | null>;
  covered?: boolean;
  onClose: () => void;
  onActivity: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  const activityFrameRef = useRef<number | null>(null);
  const hasMovedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    origin: Point;
    start: Point;
  } | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const laneRefs = useMemo(
    () => ({ anchorRef, characterEffectZoneRef, headerZoneRef, panelLaneRef }),
    [anchorRef, characterEffectZoneRef, headerZoneRef, panelLaneRef],
  );
  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (externalPanelRef) externalPanelRef.current = node;
    },
    [externalPanelRef],
  );

  const anchoredPosition = useCallback(() => {
    const panel = panelRef.current;
    const parentRect = panel
      ? getOffsetParentRect(panel)
      : document.documentElement.getBoundingClientRect();
    const anchor = anchorRef.current;
    const buttonRect = anchor?.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    const scale = panel ? renderedScale(panel) : { x: 1, y: 1 };
    const bounds = laneBounds(laneRefs);
    const gap = 8;
    const belowFits =
      buttonRect && panelRect && bounds
        ? buttonRect.bottom + gap + panelRect.height <= bounds.bottom
        : true;
    let left = (buttonRect?.left ?? parentRect.left + 12) - parentRect.left;
    let top = (buttonRect?.bottom ?? parentRect.top + 4) - parentRect.top + gap;
    if (buttonRect && panelRect && !belowFits) {
      left = (buttonRect.right - panelRect.width - parentRect.left) / scale.x;
      top = (buttonRect.top - gap - panelRect.height - parentRect.top) / scale.y;
      const menuRect = anchor?.closest("nav")?.getBoundingClientRect();
      const renderedTop = parentRect.top + top * scale.y;
      if (menuRect && renderedTop + panelRect.height > menuRect.top)
        top = (menuRect.top - gap - panelRect.height - parentRect.top) / scale.y;
      return { left, top };
    }
    return {
      left: left / scale.x,
      top: top / scale.y,
    };
  }, [anchorRef, laneRefs]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    setPosition(panel ? clamp(anchoredPosition(), panel, laneRefs) : anchoredPosition());
    dragHandleRef.current?.focus({ preventScroll: true });
  }, [anchoredPosition, laneRefs]);
  useEffect(
    () => () => {
      if (activityFrameRef.current !== null) cancelAnimationFrame(activityFrameRef.current);
    },
    [],
  );
  useEffect(() => {
    const onResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const next = hasMovedRef.current && position ? position : anchoredPosition();
      setPosition(clamp(next, panel, laneRefs));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchoredPosition, laneRefs, position]);

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

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!panelRef.current) return;
    const start = position ?? anchoredPosition();
    dragRef.current = {
      pointerId: event.pointerId,
      origin: { left: event.clientX, top: event.clientY },
      start,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    scheduleActivity();
    hasMovedRef.current = true;
    const scale = renderedScale(panelRef.current!);
    move({
      left: drag.start.left + (event.clientX - drag.origin.left) / scale.x,
      top: drag.start.top + (event.clientY - drag.origin.top) / scale.y,
    });
  }

  function endPointer(event: PointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (activityFrameRef.current !== null) {
      cancelAnimationFrame(activityFrameRef.current);
      activityFrameRef.current = null;
    }
  }

  function onMoveKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!panelRef.current) return;
    if (event.key === "Home") {
      event.preventDefault();
      const panel = panelRef.current;
      setPosition(panel ? clamp(anchoredPosition(), panel, laneRefs) : anchoredPosition());
      hasMovedRef.current = false;
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
    hasMovedRef.current = true;
    move({ left: current.left + offset.left, top: current.top + offset.top });
  }

  function closeHistory() {
    onClose();
    anchorRef.current?.focus({ preventScroll: true });
  }

  return (
    <section
      ref={setPanelRef}
      className={styles.logViewContainer}
      style={{
        ...(position ? { left: position.left, top: position.top } : {}),
        visibility: covered ? "hidden" : undefined,
      }}
      aria-label="History"
      aria-hidden={covered || undefined}
      inert={covered || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        closeHistory();
      }}
    >
      <div
        className={styles.header}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <h2>History</h2>
        <button
          ref={dragHandleRef}
          className={styles.dragHandle}
          type="button"
          onKeyDown={onMoveKeyDown}
          aria-label="Move History"
        >
          <span className={styles.dotGroup} aria-hidden="true">
            <span className={styles.dots} />
            <svg
              className={styles.paw}
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 82 89"
            >
              <ellipse cx="22" cy="43" rx="6.4" ry="7.4" />
              <ellipse cx="35" cy="32" rx="6.5" ry="8.1" />
              <ellipse cx="50" cy="32" rx="6.5" ry="8.1" />
              <ellipse cx="62" cy="43" rx="6.4" ry="7.4" />
              <path d="M42 41C36 41 31 46 28 51C24 57 24 62 28 65C32 68 37 63 42 63C47 63 51 68 55 65C61 61 58 54 54 49C50 44 46 41 42 41Z" />
            </svg>
            <span className={styles.dots} />
          </span>
        </button>
        <button
          className={styles.closeButton}
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={closeHistory}
          aria-label="Close History"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
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
