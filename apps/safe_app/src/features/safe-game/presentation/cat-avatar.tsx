"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { PresentationState } from "../model/presentation-machine";
import { useSafeGameContext } from "../model/safe-game-context";
import styles from "./cat-avatar.module.css";

const artByMode: Record<PresentationState["mode"], string> = {
  PLAYING: "cat-playing-800.webp", WRONG: "cat-wrong-800.webp", LONG_IDLE: "cat-long-idle-800.webp",
  PET_PROMPT: "cat-pet-prompt-800.webp", PET_MISSED: "cat-long-idle-800.webp",
  PET_NORMAL: "cat-pet-hover-800.webp", PET_NORMAL_LEAVE_GRACE: "cat-pet-hover-800.webp",
  PET_PROMPT_SUCCESS: "cat-pet-success-800.webp", HINT_ATTENTION: "cat-hint-attention-800.webp",
  STORED_HINTS: "cat-hint-attention-800.webp", HISTORY: "cat-playing-800.webp",
  HINT_DIALOG: "cat-playing-800.webp", HINT_SUCCESS_HANDOFF: "cat-playing-800.webp",
  HINT_REWARD: "cat-playing-800.webp", WON: "cat-won-800.webp", SURRENDERED: "cat-surrendered-800.webp",
};

export function CatAvatar({ presentation }: { presentation: PresentationState }) {
  const controller = useSafeGameContext();
  const hostRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<{ id: number; type: string } | null>(null);
  const endedPet = useRef<{ roundEpoch: number; stateEpoch: number } | null>(null);
  const pettable = presentation.mode === "PLAYING" || presentation.mode === "LONG_IDLE" || presentation.mode === "PET_PROMPT" || presentation.mode === "PET_NORMAL_LEAVE_GRACE";
  const hearts = presentation.mode === "PET_NORMAL" || presentation.mode === "PET_NORMAL_LEAVE_GRACE" || presentation.mode === "PET_PROMPT_SUCCESS";
  const prompt = presentation.mode === "PET_PROMPT";
  const pointerPetNormal = presentation.mode === "PET_NORMAL" && presentation.inputModality === "pointer";
  const dialogSurface = presentation.surface === "hint-dialog";
  const endPointerPet = useCallback((stateEpoch: number) => {
    if (endedPet.current?.roundEpoch === presentation.roundEpoch && endedPet.current.stateEpoch === stateEpoch) return;
    endedPet.current = { roundEpoch: presentation.roundEpoch, stateEpoch };
    controller.catPetEnd(stateEpoch);
  }, [controller, presentation.roundEpoch]);
  const pet = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") activePointer.current = { id: event.pointerId, type: event.pointerType };
    controller.catPetStart(event.pointerType === "touch" ? "touch" : "pointer");
  };
  const keyboardPet = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); controller.catPetStart("keyboard"); }
  };
  useLayoutEffect(() => {
    if (!pointerPetNormal) return;
    const pointer = activePointer.current;
    const host = hostRef.current;
    const epoch = presentation.stateEpoch;
    if (!pointer || !host) return;
    const onPointerOver = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointer.id || event.pointerType !== pointer.type || event.pointerType === "touch") return;
      if (!host.isConnected || !(event.target instanceof Node) || host.contains(event.target)) return;
      endPointerPet(epoch);
    };
    document.addEventListener("pointerover", onPointerOver);
    return () => document.removeEventListener("pointerover", onPointerOver);
  }, [endPointerPet, pointerPetNormal, presentation.stateEpoch]);
  const visualMode = presentation.mode === "HISTORY" ? presentation.resumeMode : presentation.mode;
  const art = <span aria-hidden="true" className={styles.art}><Image src={`/safe-cat/${artByMode[visualMode]}`} alt="" fill sizes="272px" draggable={false} /></span>;
  const effect = hearts ? <span aria-hidden="true" className={styles.hearts}><i>♥</i><i>♥</i><i>♥</i></span> : null;
  const child = dialogSurface ? <div className={styles.catContainer} data-presentation-mode={presentation.mode} /> : !pettable ? <div className={styles.catContainer} data-presentation-mode={presentation.mode}>{art}{prompt && <span className={styles.prompt}>Pet me</span>}{effect}</div> : (
    <button type="button" aria-label="Pet the cat" className={styles.catContainer} data-presentation-mode={presentation.mode}
      onPointerEnter={pet} onPointerDown={pet} onKeyDown={keyboardPet}>
      {art}{prompt && <span className={styles.prompt}>Pet me</span>}{effect}
    </button>
  );
  return <div ref={hostRef} className={styles.catContainer}
    onPointerLeave={pointerPetNormal ? () => endPointerPet(presentation.stateEpoch) : undefined}>{child}</div>;
}
