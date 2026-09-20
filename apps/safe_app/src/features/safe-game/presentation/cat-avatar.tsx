"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { PresentationState } from "../model/presentation-machine";
import { useSafeGameContext } from "../model/safe-game-context";
import styles from "./cat-avatar.module.css";

const artByMode: Record<PresentationState["mode"], string> = {
  PLAYING: "cat-playing-800.webp", WRONG: "cat-wrong-800.webp", LONG_IDLE: "cat-long-idle-800.webp",
  PET_PROMPT: "cat-pet-prompt-800.webp", PET_MISSED: "cat-long-idle-800.webp",
  PET_NORMAL: "cat-pet-hover-800.webp", PET_NORMAL_LEAVE_GRACE: "cat-pet-hover-800.webp",
  PET_PROMPT_SUCCESS: "cat-pet-success-800.webp", HINT_ATTENTION: "cat-hint-attention-800.webp", TERMINAL_STORED_HINTS_PENDING: "cat-playing-800.webp",
  STORED_HINTS: "cat-hint-attention-800.webp", HISTORY: "cat-playing-800.webp",
  HINT_DIALOG: "cat-playing-800.webp", HINT_SUCCESS_HANDOFF: "cat-playing-800.webp",
  HINT_REWARD: "cat-playing-800.webp", WON: "cat-won-800.webp", SURRENDERED: "cat-surrendered-800.webp",
};

const unavailableCatLabel: Partial<Record<PresentationState["mode"], string>> = {
  WRONG: "Cat is waiting for a new code",
  PET_MISSED: "Cat missed the petting prompt",
  PET_NORMAL: "Cat is enjoying the pets",
  PET_PROMPT_SUCCESS: "Cat is enjoying the pets",
  HINT_ATTENTION: "Cat is waiting while the hint is open",
  TERMINAL_STORED_HINTS_PENDING: "Cat is not available to pet",
  STORED_HINTS: "Cat is not available to pet",
  HISTORY: "Cat is not available to pet",
  WON: "Cat is celebrating the win",
  SURRENDERED: "Cat is not available to pet",
};

type AlphaMask = { src: string; width: number; height: number; pixels: Uint8ClampedArray };
type VisibleArtEvent = {
  currentTarget: HTMLButtonElement;
  target: EventTarget | null;
  clientX: number;
  clientY: number;
};
type BurstOrigin = { x: number; y: number; rise: number };

function cappedHeartRise(button: HTMLButtonElement, clientY: number) {
  const screen = button.closest("main");
  const header = screen?.querySelector("header");
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
  const screenGap = Number.parseFloat(screen ? getComputedStyle(screen).getPropertyValue("--header-gap") : "") || 8;
  const bounds = button.getBoundingClientRect();
  const localWidth = button.offsetWidth;
  const localHeight = button.offsetHeight;
  const renderedScale = Math.max(
    localWidth > 0 ? bounds.width / localWidth : 0,
    localHeight > 0 ? bounds.height / localHeight : 0,
  ) || 1;
  // --heart-rise is a local CSS length, while the stage can be transformed.
  // Reserve the rendered header gap and the 22px painted heart envelope before
  // converting the remaining rendered space back to local CSS pixels.
  const renderedEnvelope = 22 * renderedScale;
  const availableRenderedRise = clientY - headerBottom - screenGap * renderedScale - renderedEnvelope;
  return Math.max(0, Math.min(42 / renderedScale, availableRenderedRise / renderedScale));
}

export function CatAvatar({ presentation }: { presentation: PresentationState }) {
  const controller = useSafeGameContext();
  const artRef = useRef<HTMLSpanElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);
  const activation = useRef<{ modality: "pointer" | "touch"; x: number; y: number; rise: number } | null>(null);
  const alphaMask = useRef<AlphaMask | null>(null);
  const [burstOrigin, setBurstOrigin] = useState<BurstOrigin>({ x: 50, y: 50, rise: 42 });
  const suppressKeyboardClick = useRef(false);
  const pettable = presentation.mode === "PLAYING" || presentation.mode === "LONG_IDLE" || presentation.mode === "PET_PROMPT";
  const hearts = presentation.mode === "PET_NORMAL" || presentation.mode === "PET_PROMPT_SUCCESS";
  const burstId = presentation.mode === "PET_NORMAL" || presentation.mode === "PET_PROMPT_SUCCESS"
    ? presentation.burstId
    : 0;
  const prompt = presentation.mode === "PET_PROMPT";
  const dialogSurface = presentation.surface === "hint-dialog";
  const catLabel = pettable
    ? "Pet the cat"
    : unavailableCatLabel[presentation.mode] ?? "Cat is not available to pet";
  const pointHitsVisibleArt = (event: VisibleArtEvent) => {
    const promptElement = event.currentTarget.querySelector("[data-pet-prompt]");
    if (promptElement && event.target instanceof Node && promptElement.contains(event.target)) return true;
    const image = artRef.current?.querySelector<HTMLImageElement>("img");
    if (!image?.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return false;
    const src = image.currentSrc || image.src;
    let mask = alphaMask.current;
    if (!mask || mask.src !== src || mask.width !== image.naturalWidth || mask.height !== image.naturalHeight) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return false;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        mask = { src, width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
        alphaMask.current = mask;
      } catch {
        return false;
      }
    }
    const rect = image.getBoundingClientRect();
    const scale = Math.min(rect.width / mask.width, rect.height / mask.height);
    if (!(scale > 0)) return false;
    const width = mask.width * scale;
    const height = mask.height * scale;
    const left = rect.left + (rect.width - width) / 2;
    const top = rect.bottom - height;
    if (event.clientX < left || event.clientX >= left + width || event.clientY < top || event.clientY >= top + height) return false;
    const x = Math.min(mask.width - 1, Math.floor(((event.clientX - left) / width) * mask.width));
    const y = Math.min(mask.height - 1, Math.floor(((event.clientY - top) / height) * mask.height));
    return mask.pixels[(y * mask.width + x) * 4 + 3] > 8;
  };
  useLayoutEffect(() => {
    if (!hearts) return;
    const button = activeButtonRef.current;
    if (!button) return;
    let active = true;
    const refreshBurstRise = () => {
      if (!active) return;
      const bounds = button.getBoundingClientRect();
      setBurstOrigin((current) => {
        const currentClientY = bounds.top + (bounds.height * current.y) / 100;
        const rise = cappedHeartRise(button, currentClientY);
        return Math.abs(current.rise - rise) < 0.01 ? current : { ...current, rise };
      });
    };
    refreshBurstRise();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refreshBurstRise);
    observer?.observe(button);
    const viewport = window.visualViewport;
    window.addEventListener("resize", refreshBurstRise);
    viewport?.addEventListener("resize", refreshBurstRise);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", refreshBurstRise);
      viewport?.removeEventListener("resize", refreshBurstRise);
    };
  }, [hearts, burstId]);
  const captureActivation = (event: PointerEvent<HTMLButtonElement>) => {
    activation.current = null;
    if (!pointHitsVisibleArt(event)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.width === 0 ? 50 : Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = bounds.height === 0 ? 50 : Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    activation.current = {
      modality: event.pointerType === "touch" ? "touch" : "pointer",
      x,
      y,
      rise: cappedHeartRise(event.currentTarget, event.clientY),
    };
  };
  const keyboardPet = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activation.current = null;
      const bounds = event.currentTarget.getBoundingClientRect();
      setBurstOrigin({ x: 50, y: 50, rise: cappedHeartRise(event.currentTarget, bounds.top + bounds.height / 2) });
      suppressKeyboardClick.current = true;
      queueMicrotask(() => { suppressKeyboardClick.current = false; });
      controller.catPetStart("keyboard");
    }
  };
  const pet = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 && suppressKeyboardClick.current) {
      suppressKeyboardClick.current = false;
      activation.current = null;
      return;
    }
    const current = event.detail === 0 ? null : activation.current;
    activation.current = null;
    if (event.detail !== 0 && !current) return;
    if (event.detail !== 0 && !pointHitsVisibleArt(event)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setBurstOrigin(current
      ? { x: current.x, y: current.y, rise: current.rise }
      : { x: 50, y: 50, rise: cappedHeartRise(event.currentTarget, bounds.top + bounds.height / 2) });
    controller.catPetStart(current?.modality ?? (event.detail === 0 ? "keyboard" : "pointer"));
  };
  const visualMode = presentation.mode === "HISTORY" || ((presentation.mode === "TERMINAL_STORED_HINTS_PENDING" || presentation.mode === "STORED_HINTS") && (presentation.resumeMode === "WON" || presentation.resumeMode === "SURRENDERED")) ? presentation.resumeMode : presentation.mode;
  const art = <span ref={artRef} aria-hidden="true" className={styles.art}><Image src={`/safe-cat/${artByMode[visualMode]}`} alt="" fill sizes="272px" loading="eager" draggable={false} /></span>;
  const heartStyle = {
    "--heart-origin-x": `${burstOrigin.x}%`,
    "--heart-origin-y": `${burstOrigin.y}%`,
    "--heart-rise": `${burstOrigin.rise}px`,
  } as CSSProperties;
  const effect = hearts ? <span key={presentation.burstId} aria-hidden="true" className={styles.hearts} style={heartStyle}><i>♥</i><i>♥</i><i>♥</i></span> : null;
  const child = dialogSurface ? <div className={styles.catContainer} data-presentation-mode={presentation.mode} /> : !pettable ? (
    <button ref={activeButtonRef} type="button" disabled aria-label={catLabel} className={styles.catContainer} data-presentation-mode={presentation.mode}>
      {art}{prompt && <span className={styles.prompt}>Pet me</span>}{effect}
    </button>
  ) : (
    <button type="button" aria-label={catLabel} className={styles.catContainer} data-presentation-mode={presentation.mode}
      onPointerDown={captureActivation} onPointerCancel={() => { activation.current = null; }} onClick={pet} onKeyDown={keyboardPet}>
      {art}{prompt && <span data-pet-prompt className={styles.prompt}>Pet me</span>}{effect}
    </button>
  );
  return <div className={styles.catContainer} data-visual-mode={visualMode}>{child}</div>;
}
