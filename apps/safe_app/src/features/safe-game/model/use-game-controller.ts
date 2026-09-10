import { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { createHintChallenge, createSafeGameState, generateSafeCode, reduceSafeGame } from "../domain";
import type { HintOperator, SafeGameAction, SafeGameState } from "../domain";
import { createChallengeId } from "./challenge-id";

type FocusTarget = "hint" | "input" | "new-game" | null;

function createInitialGameState() {
  return createSafeGameState(generateSafeCode(Math.random));
}

export function useGameController() {
  const [state, dispatch] = useReducer<SafeGameState, undefined, [SafeGameAction]>(reduceSafeGame, undefined, createInitialGameState);
  const stateRef = useRef<SafeGameState | null>(null);
  const roundGenerationRef = useRef(0);
  const pendingHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocusRef = useRef<FocusTarget>("input");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hintButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  const newGameButtonRef = useRef<HTMLButtonElement | null>(null);
  const newHintButtonRef = useRef<HTMLButtonElement | null>(null);

  // Browser callbacks consult committed state, never a speculative render's snapshot.
  useLayoutEffect(() => { stateRef.current = state; }, [state]);

  function currentState() {
    return stateRef.current ?? state;
  }

  function clearPendingHoverTimer() {
    // Invalidate queued work as well as clearing the currently scheduled timeout.
    roundGenerationRef.current += 1;
    if (pendingHoverTimerRef.current) {
      clearTimeout(pendingHoverTimerRef.current);
      pendingHoverTimerRef.current = null;
    }
  }

  function focusCurrentTarget(target: FocusTarget) {
    const candidate = target === "hint" ? hintButtonRef.current : target === "new-game" ? newGameButtonRef.current : inputRef.current;
    if (candidate && !candidate.disabled && candidate.isConnected) candidate.focus();
  }

  useEffect(() => () => clearPendingHoverTimer(), []);
  useEffect(() => {
    if (state.phase !== "playing") clearPendingHoverTimer();
  }, [state.phase]);
  useEffect(() => {
    if (state.phase !== "playing") {
      focusCurrentTarget("new-game");
    } else if (!state.hintChallenge) {
      // Keep dialog autofocus intact until the current challenge actually closes.
      focusCurrentTarget(pendingFocusRef.current ?? "input");
    }
    pendingFocusRef.current = null;
  }, [state.phase, state.roundId, state.hintChallenge]);

  function startNewRound() {
    clearPendingHoverTimer();
    pendingFocusRef.current = "input";
    dispatch({ type: "new-round", code: generateSafeCode(Math.random) });
  }

  function submitGuess() {
    if (currentState().phase !== "playing") return;
    dispatch({ type: "submit-guess" });
  }

  function changeGuessInput(input: string) {
    dispatch({ type: "set-input", input });
  }

  function surrenderRound() {
    if (currentState().phase !== "playing") return;
    clearPendingHoverTimer();
    pendingFocusRef.current = "new-game";
    dispatch({ type: "surrender" });
  }

  function toggleHistory() {
    dispatch({ type: "toggle-history" });
  }

  function showHint() {
    const latestState = currentState();
    if (latestState.phase !== "playing") return;
    const challenge = createHintChallenge(
      Math.random,
      latestState.roundId,
      "+",
      createChallengeId(Math.random, Date.now, globalThis.crypto?.randomUUID?.bind(globalThis.crypto)),
    );
    dispatch({ type: "show-hint", challenge });
  }

  function replaceHintChallenge(roundId: number, challengeId: string, operator: HintOperator) {
    // An event from an old dialog must not replace the currently mounted question.
    const latestState = currentState();
    const challenge = latestState.hintChallenge;
    if (!challenge || latestState.phase !== "playing" || challenge.roundId !== roundId || challenge.challengeId !== challengeId) return;
    clearPendingHoverTimer();
    const replacement = createHintChallenge(
      Math.random,
      challenge.roundId,
      operator,
      createChallengeId(Math.random, Date.now, globalThis.crypto?.randomUUID?.bind(globalThis.crypto)),
    );
    dispatch({ type: "replace-hint-challenge", roundId: challenge.roundId, challengeId: challenge.challengeId, challenge: replacement });
  }

  function closeHintChallenge(roundId: number, challengeId: string) {
    const challenge = currentState().hintChallenge;
    if (!challenge || challenge.roundId !== roundId || challenge.challengeId !== challengeId) return;
    pendingFocusRef.current = "hint";
    dispatch({ type: "close-hint-challenge", roundId: challenge.roundId, challengeId: challenge.challengeId });
  }

  function submitHintAnswer(roundId: number, challengeId: string, answer: number | null) {
    const challenge = currentState().hintChallenge;
    if (!challenge || challenge.roundId !== roundId || challenge.challengeId !== challengeId) return;
    if (answer === challenge.expectedAnswer) pendingFocusRef.current = "hint";
    dispatch({ type: "submit-hint-answer", roundId: challenge.roundId, challengeId: challenge.challengeId, answer });
  }

  function giveUpHintChallenge(roundId: number, challengeId: string) {
    const challenge = currentState().hintChallenge;
    if (!challenge || challenge.roundId !== roundId || challenge.challengeId !== challengeId) return;
    dispatch({ type: "give-up-hint-challenge", roundId: challenge.roundId, challengeId: challenge.challengeId });
    const newHintButton = newHintButtonRef.current;
    if (newHintButton && !newHintButton.disabled && newHintButton.isConnected) newHintButton.focus();
  }

  function handleCatEnter() {
    clearPendingHoverTimer();
    if (currentState().phase === "playing") dispatch({ type: "set-cat-hover", active: true });
  }

  function handleCatLeave() {
    clearPendingHoverTimer();
    const roundId = currentState().roundId;
    const generation = roundGenerationRef.current;
    pendingHoverTimerRef.current = setTimeout(() => {
      const latestState = stateRef.current;
      if (latestState && roundGenerationRef.current === generation && latestState.phase === "playing" && latestState.roundId === roundId) {
        dispatch({ type: "set-cat-hover", active: false });
      }
    }, 250);
  }

  return {
    state,
    inputRef,
    hintButtonRef,
    historyButtonRef,
    newGameButtonRef,
    newHintButtonRef,
    startNewRound,
    submitGuess,
    changeGuessInput,
    surrenderRound,
    toggleHistory,
    showHint,
    replaceHintChallenge,
    closeHintChallenge,
    submitHintAnswer,
    giveUpHintChallenge,
    handleCatEnter,
    handleCatLeave,
  };
}
