"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
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

type AlphaMask = { src: string; width: number; height: number; pixels: Uint8ClampedArray; left: number; right: number; top: number; bottom: number };
type VisibleArtEvent = {
  currentTarget: HTMLButtonElement;
  target: EventTarget | null;
  clientX: number;
  clientY: number;
};
type BurstOrigin = { x: number; y: number; rise: number };
type Burst = BurstOrigin & { id: string };

const normalBurstLifetime = 1300;
const reducedBurstLifetime = 700;

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
  const promptRef = useRef<HTMLSpanElement>(null);
  const activation = useRef<{ modality: "pointer" | "touch"; x: number; y: number; rise: number } | null>(null);
  const burstTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const burstSequence = useRef(0);
  const observedRoundEpoch = useRef(presentation.roundEpoch);
  const alphaMask = useRef<AlphaMask | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [promptTop, setPromptTop] = useState<number | null>(null);
  const [promptLeft, setPromptLeft] = useState<number | null>(null);
  const [artRevision, setArtRevision] = useState(0);
  const suppressKeyboardClick = useRef(false);
  const pettable = presentation.mode === "PLAYING" || presentation.mode === "LONG_IDLE" || presentation.mode === "PET_PROMPT" || presentation.mode === "PET_NORMAL" || presentation.mode === "PET_PROMPT_SUCCESS";
  const prompt = presentation.mode === "PET_PROMPT";
  const dialogSurface = presentation.surface === "hint-dialog";
  const catLabel = pettable
    ? "Pet the cat"
    : unavailableCatLabel[presentation.mode] ?? "Cat is not available to pet";
  const readAlphaMask = (image: HTMLImageElement) => {
    // Hit testing and overlay anchors follow painted pixels, never transparent asset padding.
    const src = image.currentSrc || image.src;
    let mask = alphaMask.current;
    if (mask && mask.src === src && mask.width === image.naturalWidth && mask.height === image.naturalHeight) return mask;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = image.naturalWidth;
    let right = -1;
    let top = image.naturalHeight;
    let bottom = -1;
    for (let y = 0; y < image.naturalHeight; y += 1) {
      for (let x = 0; x < image.naturalWidth; x += 1) {
        if (pixels[(y * image.naturalWidth + x) * 4 + 3] > 8) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    mask = { src, width: canvas.width, height: canvas.height, pixels, left, right, top, bottom };
    alphaMask.current = mask;
    return mask;
  };
  const paintedOrigin = (button: HTMLButtonElement): BurstOrigin => {
    const image = artRef.current?.querySelector<HTMLImageElement>("img");
    if (!image?.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
      const bounds = button.getBoundingClientRect();
      return { x: 50, y: 50, rise: cappedHeartRise(button, bounds.top + bounds.height / 2) };
    }
    try {
      const mask = readAlphaMask(image);
      if (!mask || mask.right < mask.left || mask.bottom < mask.top) throw new Error("No painted alpha");
      const imageBox = image.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      const scale = Math.min(imageBox.width / mask.width, imageBox.height / mask.height);
      if (!(scale > 0) || buttonBox.width === 0 || buttonBox.height === 0) throw new Error("No rendered art");
      const canvasLeft = imageBox.left + (imageBox.width - mask.width * scale) / 2;
      const canvasTop = imageBox.bottom - mask.height * scale;
      const clientX = canvasLeft + (mask.left + mask.right + 1) * scale / 2;
      const clientY = canvasTop + (mask.top + mask.bottom + 1) * scale / 2;
      return {
        x: Math.min(100, Math.max(0, ((clientX - buttonBox.left) / buttonBox.width) * 100)),
        y: Math.min(100, Math.max(0, ((clientY - buttonBox.top) / buttonBox.height) * 100)),
        rise: cappedHeartRise(button, clientY),
      };
    } catch {
      const bounds = button.getBoundingClientRect();
      return { x: 50, y: 50, rise: cappedHeartRise(button, bounds.top + bounds.height / 2) };
    }
  };
  const pointHitsVisibleArt = (event: VisibleArtEvent) => {
    const promptElement = event.currentTarget.querySelector("[data-pet-prompt]");
    if (promptElement && event.target instanceof Node && promptElement.contains(event.target)) return true;
    const image = artRef.current?.querySelector<HTMLImageElement>("img");
    if (!image?.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return false;
    let mask: AlphaMask | null;
    try { mask = readAlphaMask(image); } catch { return false; }
    if (!mask) return false;
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
    if (bursts.length === 0) return;
    const button = activeButtonRef.current;
    if (!button) return;
    let active = true;
    const refreshBurstRise = () => {
      if (!active) return;
      const bounds = button.getBoundingClientRect();
      setBursts((current) => current.map((burst) => {
        const currentClientY = bounds.top + (bounds.height * burst.y) / 100;
        const rise = cappedHeartRise(button, currentClientY);
        return Math.abs(burst.rise - rise) < 0.01 ? burst : { ...burst, rise };
      }));
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
  }, [bursts.length]);
  useLayoutEffect(() => {
    if (!prompt) return;
    const button = activeButtonRef.current;
    const image = artRef.current?.querySelector<HTMLImageElement>("img");
    const promptElement = promptRef.current;
    if (!button || !image || !promptElement || !image.complete || image.naturalWidth === 0) return;
    const positionPrompt = () => {
      try {
        const mask = readAlphaMask(image);
        if (!mask) return;
        const imageBox = image.getBoundingClientRect();
        const buttonBox = button.getBoundingClientRect();
        const scale = Math.min(imageBox.width / mask.width, imageBox.height / mask.height);
        const renderedScale = button.offsetHeight > 0 ? buttonBox.height / button.offsetHeight : 1;
        if (!(scale > 0) || !(renderedScale > 0)) return;
        const paintedTop = imageBox.bottom - mask.height * scale + mask.top * scale;
        const paintedCenter = imageBox.left + (imageBox.width - mask.width * scale) / 2 + (mask.left + mask.right + 1) * scale / 2;
        const gap = 6 / renderedScale;
        setPromptTop((paintedTop - buttonBox.top) / renderedScale - promptElement.getBoundingClientRect().height / renderedScale - gap);
        setPromptLeft((paintedCenter - buttonBox.left) / renderedScale);
      } catch {
        return;
      }
    };
    positionPrompt();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(positionPrompt);
    observer?.observe(button);
    return () => observer?.disconnect();
  }, [prompt, artRevision]);
  const clearBursts = () => {
    for (const timeout of burstTimers.current.values()) clearTimeout(timeout);
    burstTimers.current.clear();
    setBursts([]);
  };
  useEffect(() => {
    if (observedRoundEpoch.current !== presentation.roundEpoch) {
      clearBursts();
      observedRoundEpoch.current = presentation.roundEpoch;
      return;
    }
    const burstSurface = presentation.mode === "PLAYING" || presentation.mode === "LONG_IDLE" || presentation.mode === "PET_PROMPT" || presentation.mode === "PET_NORMAL" || presentation.mode === "PET_PROMPT_SUCCESS";
    if (burstSurface && !dialogSurface) return;
    clearBursts();
  }, [dialogSurface, presentation.mode, presentation.roundEpoch]);
  const startBurst = (origin: BurstOrigin, modality: "pointer" | "keyboard" | "touch") => {
    if (!controller.catPetStart(modality)) return;
    const lifetime = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? reducedBurstLifetime : normalBurstLifetime;
    const burst = { ...origin, id: String(++burstSequence.current) };
    setBursts((current) => [...current, burst]);
    burstTimers.current.set(burst.id, setTimeout(() => {
      burstTimers.current.delete(burst.id);
      setBursts((current) => current.filter((currentBurst) => currentBurst.id !== burst.id));
    }, lifetime));
  };
  useEffect(() => () => clearBursts(), []);
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
      startBurst(paintedOrigin(event.currentTarget), "keyboard");
      suppressKeyboardClick.current = true;
      queueMicrotask(() => { suppressKeyboardClick.current = false; });
    }
  };
  const pet = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 && suppressKeyboardClick.current) {
      suppressKeyboardClick.current = false;
      activation.current = null;
      return;
    }
    let current = event.detail === 0 ? null : activation.current;
    activation.current = null;
    if (event.detail !== 0 && !current) return;
    if (event.detail !== 0 && !pointHitsVisibleArt(event)) return;
    if (current) {
      const bounds = event.currentTarget.getBoundingClientRect();
      current = {
        modality: current.modality,
        x: bounds.width === 0 ? 50 : Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
        y: bounds.height === 0 ? 50 : Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)),
        rise: cappedHeartRise(event.currentTarget, event.clientY),
      };
    }
    startBurst(current
      ? { x: current.x, y: current.y, rise: current.rise }
      : paintedOrigin(event.currentTarget), current?.modality ?? (event.detail === 0 ? "keyboard" : "pointer"));
  };
  const visualMode = presentation.mode === "HISTORY" || ((presentation.mode === "TERMINAL_STORED_HINTS_PENDING" || presentation.mode === "STORED_HINTS") && (presentation.resumeMode === "WON" || presentation.resumeMode === "SURRENDERED")) ? presentation.resumeMode : presentation.mode;
  const art = <span ref={artRef} aria-hidden="true" className={styles.art}><Image src={`/safe-cat/${artByMode[visualMode]}`} alt="" fill sizes="272px" loading="eager" draggable={false} onLoad={() => setArtRevision((revision) => revision + 1)} /></span>;
  const effect = bursts.map((burst) => <span key={burst.id} data-pet-burst-id={burst.id} aria-hidden="true" className={styles.hearts} style={{ "--heart-origin-x": `${burst.x}%`, "--heart-origin-y": `${burst.y}%`, "--heart-rise": `${burst.rise}px` } as CSSProperties}><i aria-hidden="true">♥</i><i aria-hidden="true">♥</i><i aria-hidden="true">♥</i></span>);
  const promptNode = prompt && <span ref={promptRef} data-pet-prompt className={styles.prompt} style={promptTop === null || promptLeft === null ? undefined : { "--pet-prompt-top": `${promptTop}px`, "--pet-prompt-left": `${promptLeft}px` } as CSSProperties}>Pet me</span>;
  const child = dialogSurface ? <div className={styles.catContainer} data-presentation-mode={presentation.mode} /> : !pettable ? (
    <button ref={activeButtonRef} type="button" disabled aria-label={catLabel} className={styles.catContainer} data-presentation-mode={presentation.mode}>
      {art}{promptNode}{effect}
    </button>
  ) : (
    <button ref={activeButtonRef} type="button" aria-label={catLabel} className={styles.catContainer} data-presentation-mode={presentation.mode}
      onPointerDown={captureActivation} onPointerCancel={() => { activation.current = null; }} onClick={pet} onKeyDown={keyboardPet}>
      {art}{promptNode}{effect}
    </button>
  );
  return <div className={styles.catContainer} data-visual-mode={visualMode}>{child}</div>;
}
