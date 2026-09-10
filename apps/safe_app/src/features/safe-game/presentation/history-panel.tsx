"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import styles from "./history-panel.module.css";

type Point = { left: number; top: number };

function getOffsetParentRect(panel: HTMLDivElement) {
  const offsetParent = panel.offsetParent;
  return offsetParent instanceof HTMLElement
    ? offsetParent.getBoundingClientRect()
    : document.documentElement.getBoundingClientRect();
}

function clamp(point: Point, panel: HTMLDivElement) {
  // CSS offsets are relative to the containing block, while bounds remain viewport-relative.
  const margin = 8;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const parentRect = getOffsetParentRect(panel);
  return {
    left: Math.max(margin - parentRect.left, Math.min(point.left, window.innerWidth - width - margin - parentRect.left)),
    top: Math.max(margin - parentRect.top, Math.min(point.top, window.innerHeight - height - margin - parentRect.top)),
  };
}

export function HistoryPanel({ attempts, anchorRef }: { attempts: number[]; anchorRef: RefObject<HTMLButtonElement | null> }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; origin: Point; start: Point } | null>(null);
  const [position, setPosition] = useState<Point | null>(null);

  const anchoredPosition = useCallback(() => {
    // Initial placement follows the button in document space; only user movement is viewport-clamped.
    const panel = panelRef.current;
    const parentRect = panel ? getOffsetParentRect(panel) : document.documentElement.getBoundingClientRect();
    const buttonRect = anchorRef.current?.getBoundingClientRect();
    return {
      left: (buttonRect?.left ?? parentRect.left + 12) - parentRect.left,
      top: (buttonRect?.bottom ?? parentRect.top + 4) - parentRect.top + 8,
    };
  }, [anchorRef]);

  useLayoutEffect(() => { setPosition(anchoredPosition()); }, [anchoredPosition]);
  useEffect(() => {
    const onResize = () => {
      if (panelRef.current && position) setPosition(clamp(position, panelRef.current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position]);

  function move(next: Point) {
    if (panelRef.current) setPosition(clamp(next, panelRef.current));
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!panelRef.current) return;
    const start = position ?? anchoredPosition();
    dragRef.current = { pointerId: event.pointerId, origin: { left: event.clientX, top: event.clientY }, start };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    move({ left: drag.start.left + event.clientX - drag.origin.left, top: drag.start.top + event.clientY - drag.origin.top });
  }

  function endPointer(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function onMoveKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!panelRef.current) return;
    if (event.key === "Home") {
      event.preventDefault();
      setPosition(anchoredPosition());
      return;
    }
    const amount = event.shiftKey ? 1 : 10;
    const offsets: Record<string, Point> = {
      ArrowLeft: { left: -amount, top: 0 }, ArrowRight: { left: amount, top: 0 }, ArrowUp: { left: 0, top: -amount }, ArrowDown: { left: 0, top: amount },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const current = position ?? anchoredPosition();
    move({ left: current.left + offset.left, top: current.top + offset.top });
  }

  return (
    <section ref={panelRef} className={styles.logViewContainer} style={position ? { left: position.left, top: position.top } : undefined} aria-label="History">
      <button className={styles.dragHandle} type="button" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer} onPointerCancel={endPointer} onKeyDown={onMoveKeyDown}>Move History</button>
      <h2>History</h2>
      <div className={styles.entries} aria-live="polite">{attempts.length === 0 ? <p>No valid attempts yet.</p> : <ol>{attempts.map((attempt) => <li key={attempt}>{attempt}</li>)}</ol>}</div>
    </section>
  );
}
