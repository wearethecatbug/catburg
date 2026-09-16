"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  reducePresentation,
  type PresentationEvent,
  type PresentationState,
  type PresentationTimerToken,
} from "./presentation-machine";

function timerExpired(token: PresentationTimerToken): PresentationEvent {
  switch (token.kind) {
    case "idle": return { type: "IDLE_EXPIRED", token };
    case "prompt-due": return { type: "PET_PROMPT_DUE_EXPIRED", token };
    case "prompt-expiry": return { type: "PET_PROMPT_EXPIRED", token };
    case "prompt-missed-settle": return { type: "PET_MISSED_EXPIRED", token };
    case "pet-normal-settle": return { type: "PET_NORMAL_SETTLE_EXPIRED", token };
    case "pet-normal-leave-grace": return { type: "PET_NORMAL_LEAVE_GRACE_EXPIRED", token };
    case "pet-prompt-success-settle": return { type: "PET_PROMPT_SUCCESS_EXPIRED", token };
    case "stored-open": return { type: "STORED_OPEN_EXPIRED", token };
    case "stored-close": return { type: "STORED_CLOSE_EXPIRED", token };
    case "hint-success": return { type: "HINT_SUCCESS_EXPIRED", token };
    case "reward-expiry": return { type: "REWARD_EXPIRED", token };
  }
}

function now() {
  return performance.now();
}

/** The sole browser deadline owner for the closed presentation reducer. */
export function usePresentationMachine(roundEpoch: number) {
  const [presentation, setPresentation] = useState<PresentationState>(() =>
    reducePresentation(null, { type: "ROUND_STARTED", roundEpoch }, now()),
  );
  const current = useRef(presentation);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    current.current = presentation;
  }, [presentation]);

  const send = useCallback((event: PresentationEvent) => {
    const at = now();
    setPresentation((previous) => {
      const next = reducePresentation(previous, event, at);
      current.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    send({ type: "ROUND_STARTED", roundEpoch });
  }, [roundEpoch, send]);

  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
    const token = presentation.timer;
    if (!token || presentation.visibility !== "visible") return;
    const delay = Math.max(0, token.dueAt - now());
    timeout.current = setTimeout(() => {
      timeout.current = null;
      send(timerExpired(token));
    }, delay);
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
    };
  }, [presentation, send]);

  useEffect(() => {
    const onVisibility = () =>
      send({
        type: document.hidden ? "DOCUMENT_HIDDEN" : "DOCUMENT_VISIBLE",
        roundEpoch: current.current.roundEpoch,
      });
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [send]);

  return { presentation, send };
}
