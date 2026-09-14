"use client";

import { useLayoutEffect, useRef, useState } from "react";
import styles from "./curved-title.module.css";

const canonical = 4;
const frames = [
  [0, 4],
  [130, 76],
  [288, -30],
  [439, 32],
  [569, 0],
  [720, 4],
] as const;

export function CurvedTitle({ run }: { run: number }) {
  const [controlY, setControlY] = useState(canonical);
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);

  useLayoutEffect(() => {
    timer.current.forEach(clearTimeout);
    setControlY(canonical);
    if (
      !run ||
      matchMedia("(max-width: 390px), (prefers-reduced-motion: reduce)").matches
    )
      return;
    timer.current = frames
      .slice(1)
      .map(([at, value]) => setTimeout(() => setControlY(value), at));
    return () => timer.current.forEach(clearTimeout);
  }, [run]);

  return (
    <h1 className={styles.title}>
      <span className={styles.visuallyHidden}>Guess the number</span>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 400 72">
        <defs>
          <path
            id="safe-cat-title-arc"
            d={`M 36 59 Q 200 ${controlY} 364 59`}
          />
        </defs>
        <path
          className={styles.marks}
          d="M 15 35 L 24 40 M 14 51 L 23 47 M 376 40 L 385 35 M 377 47 L 386 51"
        />
        <text textAnchor="middle">
          <textPath
            href="#safe-cat-title-arc"
            startOffset="50%"
            textLength="300"
            lengthAdjust="spacing"
          >
            Guess the number
          </textPath>
        </text>
      </svg>
    </h1>
  );
}
