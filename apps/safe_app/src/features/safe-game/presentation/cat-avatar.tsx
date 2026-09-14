"use client";
import styles from "./cat-avatar.module.css";
import { useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import Image from "next/image";
import type { CatReaction } from "../domain/game.types";

const skinByReaction: Record<CatReaction, string> = {
  idle: "cat-idle-768.webp",
  hover: "cat-attention-768.webp",
  wrong: "cat-wrong-768.webp",
  won: "cat-won-640.webp",
  surrendered: "cat-surrendered-640.webp",
};
const heartPatterns = [
  { x: -22, y: -10, duration: 1400, rise: 38 },
  { x: 0, y: -1, duration: 1600, rise: 46 },
  { x: 22, y: 8, duration: 1800, rise: 54 },
];
type HeartNode = {
  id: string;
  originX: number;
  originY: number;
  x: number;
  y: number;
  duration: number;
  rise: number;
};

export function CatAvatar({
  reaction,
  onMouseEnter,
  onMouseLeave,
}: {
  reaction: CatReaction;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [hearts, setHearts] = useState<HeartNode[]>([]);
  const last = useRef(-Infinity);
  // Pointer bursts use their in-target event point; keyboard activation has no coordinates, so it
  // uses the target centre. Each node cleans up on its own duration while retaining only two
  // bursts.
  const pet = (event: MouseEvent<HTMLButtonElement>) => {
    const now = Date.now();
    if (now - last.current < 900) return;
    last.current = now;
    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const width = target.offsetWidth;
    const height = target.offsetHeight;
    const keyboard = event.detail === 0;
    const clamp = (value: number, maximum: number) =>
      Math.min(maximum, Math.max(0, value));
    const originX = keyboard
      ? width / 2
      : clamp(((event.clientX - bounds.left) * width) / bounds.width, width);
    const originY = keyboard
      ? height / 2
      : clamp(((event.clientY - bounds.top) * height) / bounds.height, height);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = heartPatterns.map((pattern, index) => ({
      ...pattern,
      id: `${now}-${index}`,
      originX,
      originY,
    }));
    setHearts((old) => [...old.slice(-3), ...nodes]);
    nodes.forEach((node) =>
      setTimeout(
        () => setHearts((old) => old.filter((heart) => heart.id !== node.id)),
        reduced ? 700 : node.duration,
      ),
    );
  };
  return (
    <>
      <span
        id="safe-cat-reaction-description"
        className={styles.reactionDescription}
      >
        Cat {reaction}
      </span>
      <button
        type="button"
        aria-describedby="safe-cat-reaction-description"
        aria-label="Pet the cat"
        className={`${styles.catContainer} ${styles[reaction]}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={pet}
      >
        <span
          aria-hidden="true"
          aria-label={`Cat ${reaction}`}
          className={styles.art}
        >
          <Image
            src={`/safe-cat/${skinByReaction[reaction]}`}
            alt=""
            fill
            sizes="272px"
            draggable={false}
          />
        </span>
        <span aria-hidden="true" className={styles.hearts}>
          {hearts.map((heart) => (
            <i
              key={heart.id}
              style={
                {
                  "--origin-x": `${heart.originX}px`,
                  "--origin-y": `${heart.originY}px`,
                  "--x": `${heart.x}px`,
                  "--y": `${heart.y}px`,
                  "--duration": `${heart.duration}ms`,
                  "--rise": `${heart.rise}px`,
                } as CSSProperties
              }
            >
              ♥
            </i>
          ))}
        </span>
      </button>
    </>
  );
}
