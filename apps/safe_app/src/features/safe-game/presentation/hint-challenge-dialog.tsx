"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { KeyboardEvent } from "react";
import type { HintChallenge as HintChallengeData, HintOperator } from "../domain/game.types";
import { useSafeGameContext } from "../model/safe-game-context";
import styles from "./hint-challenge-dialog.module.css";

type HintChallengeDialogProps = {
  challenge: HintChallengeData;
};

const operatorButtons: Array<{ asset: string; label: string; operator: HintOperator }> = [
  { operator: "+", label: "Addition", asset: "/pink-plus.png" },
  { operator: "-", label: "Subtraction", asset: "/blue-minus.png" },
  { operator: "×", label: "Multiplication", asset: "/red-multiplication.png" },
  { operator: "÷", label: "Division", asset: "/yellow-division.png" },
];

export function HintChallengeDialog({ challenge }: HintChallengeDialogProps) {
  const controller = useSafeGameContext();
  const { state } = controller;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    setAnswer("");
    inputRef.current?.focus();
  }, [challenge]);

  function close() {
    controller.closeHintChallenge(challenge.roundId, challenge.challengeId);
  }

  function submit() {
    const trimmed = answer.trim();
    const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
    controller.submitHintAnswer(challenge.roundId, challenge.challengeId, parsed !== null && Number.isSafeInteger(parsed) ? parsed : null);
  }

  function replaceChallenge(operator: HintOperator) {
    controller.replaceHintChallenge(challenge.roundId, challenge.challengeId, operator);
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

  if (!state.hintChallenge || state.hintChallenge.roundId !== challenge.roundId || state.hintChallenge.challengeId !== challenge.challengeId) return null;

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
          <button type="button" className={styles.imageButton} onClick={() => controller.giveUpHintChallenge(challenge.roundId, challenge.challengeId)} disabled={isAbandoned}>
            <Image src="/give-up-hint.png" alt="" width={32} height={32} />
            <span>Give Up Hint</span>
          </button>
          <button ref={controller.newHintButtonRef} type="button" className={styles.imageButton} onClick={() => replaceChallenge(challenge.operator)}>
            <Image src="/new-hint.png" alt="" width={32} height={32} />
            <span>New Hint</span>
          </button>
        </div>
        <p className={styles.feedback} role="status">{isAbandoned ? `The answer is ${state.revealedMathAnswer}.` : state.hintFeedback === "try-again" ? "Try again." : ""}</p>
      </div>
    </div>
  );
}
