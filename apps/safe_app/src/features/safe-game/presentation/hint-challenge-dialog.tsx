"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CSSProperties, KeyboardEvent } from "react";
import type {
  HintChallenge as HintChallengeData,
  HintOperator,
} from "../domain/game.types";
import { useSafeGameContext } from "../model/safe-game-context";
import styles from "./hint-challenge-dialog.module.css";

type Props = {
  challenge: HintChallengeData;
  successFactId?: string | null;
  completionPending?: boolean;
};
type CatState = "thinking" | "concerned" | "sad" | "happy";
const operators: Array<{
  asset: string;
  label: string;
  operator: HintOperator;
}> = [
  {
    operator: "+",
    label: "Addition",
    asset: "/safe-cat/operator-add-256.png",
  },
  {
    operator: "-",
    label: "Subtraction",
    asset: "/safe-cat/operator-subtract-256.png",
  },
  {
    operator: "×",
    label: "Multiplication",
    asset: "/safe-cat/operator-multiply-256.png",
  },
  {
    operator: "÷",
    label: "Division",
    asset: "/safe-cat/operator-divide-256.png",
  },
];
const catAssets: Record<CatState, string> = {
  thinking: "/safe-cat/hint-popup-cat-thinking-new-1448.png",
  concerned: "/safe-cat/hint-popup-cat-encouraging-1448.png",
  sad: "/safe-cat/hint-popup-cat-sad-give-up-1448.png",
  happy: "/safe-cat/hint-popup-cat-success-1448.png",
};
// Wide screens retain the original seated cat set; narrow layouts use the supplied state artwork.
const desktopCatAssets: Record<CatState, string> = {
  thinking: "/safe-cat/hint-popup-cat-thinking-640.png",
  concerned: "/safe-cat/hint-popup-cat-concerned-640.png",
  sad: "/safe-cat/hint-popup-cat-sad-640.png",
  happy: "/safe-cat/hint-popup-cat-happy-640.png",
};

export function HintChallengeDialog({
  challenge,
  successFactId = null,
  completionPending = false,
}: Props) {
  const controller = useSafeGameContext();
  const completeRef = useRef(controller.completeHintSuccess);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const frameShellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [answer, setAnswer] = useState("");
  const [catState, setCatState] = useState<CatState>("thinking");
  const [retryVisible, setRetryVisible] = useState(false);
  const [frameScale, setFrameScale] = useState(0.84);
  const identity = `${challenge.roundId}:${challenge.challengeId}`;
  const active =
    controller.state.hintChallenge?.roundId === challenge.roundId &&
    controller.state.hintChallenge.challengeId === challenge.challengeId;
  const isSuccess = successFactId !== null;
  const abandoned = active && controller.state.revealedMathAnswer != null;
  const frozen = isSuccess || completionPending;
  useEffect(() => {
    completeRef.current = controller.completeHintSuccess;
  }, [controller.completeHintSuccess]);
  useEffect(() => {
    setAnswer("");
    setCatState("thinking");
    setRetryVisible(false);
    inputRef.current?.focus({ preventScroll: true });
  }, [identity]);
  useEffect(() => {
    if (frozen) closeButtonRef.current?.focus({ preventScroll: true });
  }, [frozen]);
  useEffect(() => {
    if (abandoned) setRetryVisible(false);
  }, [abandoned]);
  useEffect(() => {
    const shell = frameShellRef.current;
    if (!shell) return;
    if (typeof ResizeObserver === "undefined") return;
    const narrowLayout = window.matchMedia("(max-width: 820px)");
    const updateScale = () => {
      if (narrowLayout.matches) {
        setFrameScale((current) => (current === 1 ? current : 1));
        return;
      }
      const { width } = shell.getBoundingClientRect();
      const nextScale = Math.min(0.84, width / 1120);
      setFrameScale((current) =>
        Math.abs(current - nextScale) < 0.001 ? current : nextScale,
      );
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(shell);
    narrowLayout.addEventListener("change", updateScale);
    return () => {
      observer.disconnect();
      narrowLayout.removeEventListener("change", updateScale);
    };
  }, []);
  useEffect(() => {
    if (isSuccess) {
      setCatState("happy");
      return;
    }
    if (abandoned) {
      setCatState("sad");
      return;
    }
    const openedAt = performance.now();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    // Reconcile elapsed time after a hidden tab delays callbacks instead of restarting the deadline.
    const reconcile = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      const elapsed = performance.now() - openedAt;
      if (elapsed >= 10_000) setCatState("concerned");
      else timeout = setTimeout(reconcile, 10_000 - elapsed);
    };
    const visible = () => {
      if (!document.hidden) reconcile();
    };
    reconcile();
    document.addEventListener("visibilitychange", visible);
    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [identity, abandoned, isSuccess]);
  useEffect(() => {
    if (!isSuccess || !successFactId) return;
    // Keep the successful challenge mounted until its matching persisted fact finishes presenting.
    const timer = setTimeout(
      () =>
        completeRef.current(
          challenge.roundId,
          challenge.challengeId,
          successFactId,
        ),
      2_500,
    );
    return () => clearTimeout(timer);
  }, [challenge.challengeId, challenge.roundId, isSuccess, successFactId]);
  useEffect(() => {
    if (!isSuccess) return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && successFactId) {
        event.preventDefault();
        completeRef.current(
          challenge.roundId,
          challenge.challengeId,
          successFactId,
        );
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [challenge.challengeId, challenge.roundId, isSuccess, successFactId]);
  function completeEarly() {
    if (isSuccess && successFactId)
      completeRef.current(
        challenge.roundId,
        challenge.challengeId,
        successFactId,
      );
    else
      controller.closeHintChallenge(challenge.roundId, challenge.challengeId);
  }
  function submit() {
    if (abandoned || !active) return;
    const raw = answer.trim();
    const value = /^\d+$/.test(raw) ? Number(raw) : null;
    const submittedValue =
      value !== null && Number.isSafeInteger(value) ? value : null;
    const isCorrect = submittedValue === challenge.expectedAnswer;
    setRetryVisible(!isCorrect);
    if (!isCorrect) setCatState("concerned");
    controller.submitHintAnswer(
      challenge.roundId,
      challenge.challengeId,
      submittedValue,
    );
  }
  function replaceRandomChallenge() {
    const operator = operators[Math.floor(Math.random() * 4)]?.operator;
    if (operator)
      controller.replaceHintChallenge(
        challenge.roundId,
        challenge.challengeId,
        operator,
      );
  }
  function containFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      completeEarly();
      return;
    }
    if (event.key !== "Tab") return;
    const items = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled])",
    );
    if (!items?.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return (
    <div
      className={`${styles.backdrop} ${isSuccess ? styles.success : ""}`}
      role="presentation"
    >
      <div ref={frameShellRef} className={styles.dialogShell}>
        <div
          ref={dialogRef}
          className={`${styles.dialog} ${isSuccess ? styles.success : ""}`}
          style={{ "--dialog-scale": frameScale } as CSSProperties}
          data-frame="/safe-cat/hint-popup-background-1327.png"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hint-challenge-title"
          onKeyDown={containFocus}
        >
          <header className={styles.heading}>
            <div>
              <h2 id="hint-challenge-title">Solve a quick math question</h2>
              <p className={styles.subtitle}>
                Solve the example to earn a hint for the game.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              className={styles.closeButton}
              type="button"
              onClick={completeEarly}
              aria-label="Close hint challenge"
            >
              <Image
                src="/safe-cat/hint-popup-close-paw-128.png"
                alt=""
                width={68}
                height={68}
                draggable={false}
              />
            </button>
          </header>
          <aside className={styles.vignette} aria-hidden="true">
            {!abandoned && (
              <Image
                className={styles.lamp}
                src="/safe-cat/hint-popup-lamp-320.png"
                alt=""
                width={160}
                height={160}
                priority
              />
            )}
            <div
              className={`${styles.speechBubble} ${abandoned ? styles.abandonedBubble : ""}`}
            >
              {isSuccess
                ? "Great job! You earned a hint!"
                : abandoned
                  ? `The answer is ${controller.state.revealedMathAnswer}. No worries — try another one!`
                  : retryVisible
                    ? "Try again — you’ve got this!"
                    : "Solve this and I’ll give you a hint!"}
            </div>
            <div className={styles.catStack}>
              <picture className={styles.catPicture}>
                <source
                  media="(min-width: 821px)"
                  srcSet={desktopCatAssets[catState]}
                />
                <Image
                  className={`${styles.cat} ${catState !== "happy" ? styles.reflectedCat : ""} ${abandoned ? styles.abandonedCat : ""}`}
                  src={catAssets[catState]}
                  alt=""
                  width={260}
                  height={260}
                  draggable={false}
                  priority
                />
              </picture>
              <p className={styles.catNotice}>
                <Image
                  className={styles.catNoticeIcon}
                  src="/safe-cat/hint-popup-key-128.png"
                  alt=""
                  width={28}
                  height={28}
                />
                <span>A correct answer will unlock a hint in the game!</span>
              </p>
            </div>
          </aside>
          <section className={styles.content}>
            <div className={styles.equation}>
              <label htmlFor="hint-answer">
                {challenge.leftOperand} {challenge.operator}{" "}
                {challenge.rightOperand} = ?
              </label>
              <Image
                className={styles.calculator}
                src="/safe-cat/hint-popup-calculator-320.png"
                alt=""
                width={160}
                height={160}
                priority
              />
            </div>
            <div className={styles.answerSection}>
              <p className={styles.cardLabel}>Your answer</p>
              <form
                className={styles.answerForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <input
                  ref={inputRef}
                  id="hint-answer"
                  placeholder="Enter your answer…"
                  inputMode="numeric"
                  autoComplete="off"
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setRetryVisible(false);
                  }}
                  disabled={frozen || abandoned}
                  aria-invalid={retryVisible || undefined}
                  className={retryVisible ? styles.retryInput : undefined}
                />
                <button type="submit" disabled={frozen || abandoned}>
                  <span>Check</span>
                </button>
              </form>
            </div>
            <div className={styles.operatorSection}>
              <p className={styles.cardLabel}>Choose operator</p>
              <div
                className={styles.operatorBoard}
                aria-label="Choose a math operation"
                role="group"
              >
                {operators.map(({ asset, label, operator }) => (
                  <button
                    key={operator}
                    type="button"
                    className={styles.operatorButton}
                    aria-label={label}
                    aria-pressed={challenge.operator === operator}
                    onClick={() =>
                      controller.replaceHintChallenge(
                        challenge.roundId,
                        challenge.challengeId,
                        operator,
                      )
                    }
                    disabled={frozen || abandoned}
                  >
                    <Image
                      src={asset}
                      alt=""
                      width={80}
                      height={80}
                      draggable={false}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.operatorButton}
                  aria-label="Random operator"
                  onClick={replaceRandomChallenge}
                  disabled={frozen || abandoned}
                >
                  <Image
                    src="/safe-cat/operator-random-256.png"
                    alt=""
                    width={80}
                    height={80}
                    draggable={false}
                  />
                </button>
              </div>
            </div>
            <p className={styles.operatorHelper}>
              Choose which operations can appear in the examples.
            </p>
            <p
              className={`${styles.feedback} ${!isSuccess && (retryVisible || abandoned) ? styles.screenReaderOnly : ""}`}
              role={isSuccess ? undefined : "status"}
              aria-live={isSuccess ? undefined : "polite"}
            >
              {isSuccess
                ? ""
                : abandoned
                  ? `The answer is ${controller.state.revealedMathAnswer}. No hint was earned.`
                  : retryVisible
                    ? "Try again — you’ve got this!"
                    : ""}
            </p>
          </section>
          <div className={styles.boardActions}>
            <button
              ref={controller.newHintButtonRef}
              type="button"
              className={`${styles.imageButton} ${styles.newQuestionButton}`}
              onClick={() =>
                controller.replaceHintChallenge(
                  challenge.roundId,
                  challenge.challengeId,
                  challenge.operator,
                )
              }
              disabled={frozen}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 7a8 8 0 0 0-13.7-2.3L4 7" />
                <path d="M4 7h4V3" />
                <path d="M4 17a8 8 0 0 0 13.7 2.3L20 17" />
                <path d="M20 17h-4v4" />
              </svg>
              <span>New question</span>
            </button>
            <button
              type="button"
              className={`${styles.imageButton} ${styles.giveUpButton}`}
              onClick={() => {
                setCatState("sad");
                controller.giveUpHintChallenge(
                  challenge.roundId,
                  challenge.challengeId,
                );
              }}
              disabled={frozen || abandoned}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 21V3" />
                <path d="M5 4h11l-2 4 2 4H5" />
              </svg>
              <span>Give up</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
