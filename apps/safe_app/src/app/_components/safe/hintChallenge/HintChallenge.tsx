"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { KeyboardEvent, RefObject } from "react";
import { createHintChallenge } from "@/domain/safe-game";
import type { HintChallenge as HintChallengeData, HintOperator } from "@/domain/safe-game";
import { useSafeContext } from "@/components/safe/SafeContainerContext";
import styles from "./HintChallenge.module.css";

type HintChallengeProps = {
  challenge: HintChallengeData;
  openerRef: RefObject<HTMLButtonElement | null>;
};

const operatorButtons: Array<{ asset: string; label: string; operator: HintOperator }> = [
  { operator: "+", label: "Addition", asset: "/pinkPlus.png" },
  { operator: "-", label: "Subtraction", asset: "/blueMinus.png" },
  { operator: "×", label: "Multiplication", asset: "/redMultiple.png" },
  { operator: "÷", label: "Division", asset: "/yellowDevision.png" },
];

function createChallengeId() {
  return globalThis.crypto?.randomUUID?.() ?? `hint-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function HintChallenge({ challenge, openerRef }: HintChallengeProps) {
  const { state, dispatch } = useSafeContext();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    const opener = openerRef.current;
    return () => opener?.focus();
  }, [openerRef]);

  useEffect(() => {
    setAnswer("");
    inputRef.current?.focus();
  }, [challenge]);

  function close() {
    dispatch({ type: "close-hint-challenge", roundId: challenge.roundId, challengeId: challenge.challengeId });
  }

  function submit() {
    const trimmed = answer.trim();
    const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
    dispatch({ type: "submit-hint-answer", roundId: challenge.roundId, challengeId: challenge.challengeId, answer: parsed !== null && Number.isSafeInteger(parsed) ? parsed : null });
  }

  function replaceChallenge(operator: HintOperator) {
    dispatch({
      type: "replace-hint-challenge",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
      challenge: createHintChallenge(Math.random, challenge.roundId, operator, createChallengeId()),
    });
  }

  function containFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!state.hintChallenge || state.hintChallenge.roundId !== challenge.roundId) return null;

  const isAbandoned = state.revealedMathAnswer != null;

  return (
    <div className={styles.backdrop} role="presentation">
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="hint-challenge-title" onKeyDown={containFocus}>
        <div className={styles.heading}>
          <h2 id="hint-challenge-title">Solve a quick math question</h2>
          <button type="button" onClick={close} aria-label="Close hint challenge">Close</button>
        </div>
        <div className={styles.operatorBoard} aria-label="Choose a math operation">
          {operatorButtons.map(({ asset, label, operator }) => (
            <button
              key={operator}
              type="button"
              className={styles.operatorButton}
              aria-label={label}
              aria-pressed={challenge.operator === operator}
              onClick={() => replaceChallenge(operator)}
              disabled={isAbandoned}
            >
              <Image src={asset} alt="" width={80} height={80} />
            </button>
          ))}
        </div>
        <form className={styles.answerForm} onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <label htmlFor="hint-answer">{challenge.leftOperand} {challenge.operator} {challenge.rightOperand} =</label>
          <input ref={inputRef} id="hint-answer" inputMode="numeric" autoComplete="off" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={isAbandoned} />
          <button type="submit" disabled={isAbandoned}>Send answer</button>
        </form>
        <div className={styles.boardActions}>
          <button type="button" className={styles.imageButton} onClick={() => dispatch({ type: "give-up-hint-challenge", roundId: challenge.roundId, challengeId: challenge.challengeId })} disabled={isAbandoned}>
            <Image src="/GiveUPHint.png" alt="" width={32} height={32} />
            <span>Give Up Hint</span>
          </button>
          <button type="button" className={styles.imageButton} onClick={() => replaceChallenge(challenge.operator)}>
            <Image src="/NewHint.png" alt="" width={32} height={32} />
            <span>New Hint</span>
          </button>
        </div>
        <p className={styles.feedback} role="status">{isAbandoned ? `The answer is ${state.revealedMathAnswer}.` : state.hintFeedback === "try-again" ? "Try again." : ""}</p>
      </div>
    </div>
  );
}
