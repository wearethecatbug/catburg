import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  chooseNextHintPredicate,
  createHintChallenge,
  createSafeGameState,
  generateSafeCode,
  reduceSafeGame,
} from "../domain";
import type {
  HintChallenge,
  HintOperator,
  SafeGameAction,
  SafeGameState,
} from "../domain";
import { createChallengeId } from "./challenge-id";

type FocusTarget = "hint" | "input" | "new-game" | null;
type GuessInputEditIntent = "delete" | "insert";
export type HintSuccessPresentation = Readonly<{
  challenge: HintChallenge;
  roundId: number;
  challengeId: string;
  latestAwardedFactId: string | null;
}>;
type HintSuccessPending = Readonly<{
  challenge: HintChallenge;
  previousAwardedFactId: string | null;
}>;

function createInitialGameState() {
  return createSafeGameState(generateSafeCode(Math.random));
}

export function useGameController() {
  const [state, dispatch] = useReducer<
    SafeGameState,
    undefined,
    [SafeGameAction]
  >(reduceSafeGame, undefined, createInitialGameState);
  const stateRef = useRef<SafeGameState | null>(null);
  const roundGenerationRef = useRef(0);
  const pendingHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingFocusRef = useRef<FocusTarget>("input");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hintButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  const newGameButtonRef = useRef<HTMLButtonElement | null>(null);
  const newHintButtonRef = useRef<HTMLButtonElement | null>(null);
  const completedChallengeRef = useRef<string | null>(null);
  const [hintSuccessPresentation, setHintSuccessPresentation] =
    useState<HintSuccessPresentation | null>(null);
  const [hintSuccessPending, setHintSuccessPending] =
    useState<HintSuccessPending | null>(null);
  const [dialAngle, setDialAngle] = useState(0);
  const [titleRun, setTitleRun] = useState(0);

  // Browser callbacks consult committed state, never a speculative render's snapshot.
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    const candidate =
      target === "hint"
        ? hintButtonRef.current
        : target === "new-game"
          ? newGameButtonRef.current
          : inputRef.current;
    if (candidate && !candidate.disabled && candidate.isConnected)
      candidate.focus({ preventScroll: true });
  }

  useEffect(() => () => clearPendingHoverTimer(), []);
  useEffect(() => {
    if (state.phase !== "playing") clearPendingHoverTimer();
  }, [state.phase]);
  useEffect(() => {
    if (state.phase !== "playing") {
      focusCurrentTarget("new-game");
      pendingFocusRef.current = null;
    } else if (
      !state.hintChallenge &&
      !hintSuccessPresentation &&
      !hintSuccessPending
    ) {
      // Keep dialog autofocus intact until the current challenge actually closes.
      focusCurrentTarget(pendingFocusRef.current ?? "input");
      pendingFocusRef.current = null;
    }
  }, [
    state.phase,
    state.roundId,
    state.hintChallenge,
    hintSuccessPresentation,
    hintSuccessPending,
  ]);

  useEffect(() => {
    if (!hintSuccessPending) return;
    const pending = hintSuccessPending;
    if (state.roundId !== pending.challenge.roundId) {
      setHintSuccessPending(null);
      return;
    }
    const activeChallenge = state.hintChallenge;
    if (activeChallenge) {
      if (
        activeChallenge.roundId !== pending.challenge.roundId ||
        activeChallenge.challengeId !== pending.challenge.challengeId ||
        state.revealedMathAnswer !== null ||
        !state.activeHintPredicateId
      )
        setHintSuccessPending(null);
      return;
    }
    // Only a reducer-produced, new public fact promotes the held dialog into success.
    if (
      state.latestAwardedFactId &&
      state.latestAwardedFactId !== pending.previousAwardedFactId
    ) {
      setHintSuccessPresentation({
        challenge: pending.challenge,
        roundId: pending.challenge.roundId,
        challengeId: pending.challenge.challengeId,
        latestAwardedFactId: state.latestAwardedFactId,
      });
    }
    setHintSuccessPending(null);
  }, [
    hintSuccessPending,
    state.activeHintPredicateId,
    state.hintChallenge,
    state.latestAwardedFactId,
    state.phase,
    state.revealedMathAnswer,
    state.roundId,
  ]);

  function startNewRound() {
    clearPendingHoverTimer();
    pendingFocusRef.current = "input";
    setDialAngle(0);
    setTitleRun((run) => run + 1);
    completedChallengeRef.current = null;
    setHintSuccessPresentation(null);
    setHintSuccessPending(null);
    dispatch({ type: "new-round", code: generateSafeCode(Math.random) });
  }

  function submitGuess() {
    if (currentState().phase !== "playing") return;
    dispatch({ type: "submit-guess" });
  }

  function changeGuessInput(
    input: string,
    editIntent: GuessInputEditIntent = "insert",
  ) {
    const previous = currentState().input;
    if (input !== previous) {
      // Keep the rotation cumulative so a wrap never makes the transition spin the long way around.
      // Clearing the field still returns the dial to its neutral angle.
      if (input === "") setDialAngle(0);
      else
        setDialAngle((angle) =>
          editIntent === "delete" ? angle - 36 : angle + 36,
        );
    }
    dispatch({ type: "set-input", input });
  }

  function surrenderRound() {
    if (currentState().phase !== "playing") return;
    clearPendingHoverTimer();
    completedChallengeRef.current = null;
    pendingFocusRef.current = "new-game";
    dispatch({ type: "surrender" });
  }

  function toggleHistory() {
    dispatch({ type: "toggle-history" });
  }

  function showHint() {
    const latestState = currentState();
    if (latestState.phase !== "playing") return;
    // Only disclosed round knowledge selects the predicate that the reducer binds to this
    // challenge.
    const predicate = chooseNextHintPredicate({
      facts: latestState.earnedHintFacts,
      wrongAttempts: latestState.attempts,
      issuedPredicateIds: latestState.issuedHintPredicateIds,
    });
    if (!predicate) return;
    const challenge = createHintChallenge(
      Math.random,
      latestState.roundId,
      "+",
      createChallengeId(
        Math.random,
        Date.now,
        globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
      ),
    );
    dispatch({ type: "show-hint", challenge, predicateId: predicate.id });
  }

  function replaceHintChallenge(
    roundId: number,
    challengeId: string,
    operator: HintOperator,
  ) {
    // An event from an old dialog must not replace the currently mounted question.
    const latestState = currentState();
    const activeChallenge = latestState.hintChallenge;
    if (
      !activeChallenge ||
      latestState.phase !== "playing" ||
      activeChallenge.roundId !== roundId ||
      activeChallenge.challengeId !== challengeId
    )
      return;
    const predicate = chooseNextHintPredicate({
      facts: latestState.earnedHintFacts,
      wrongAttempts: latestState.attempts,
      issuedPredicateIds: latestState.issuedHintPredicateIds,
    });
    if (!predicate) return;
    clearPendingHoverTimer();
    const challenge = createHintChallenge(
      Math.random,
      activeChallenge.roundId,
      operator,
      createChallengeId(
        Math.random,
        Date.now,
        globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
      ),
    );
    // The reducer rejects direct replacement. Queue an identity-checked discard before the new
    // public predicate.
    dispatch({
      type: "close-hint-challenge",
      roundId: activeChallenge.roundId,
      challengeId: activeChallenge.challengeId,
    });
    dispatch({ type: "show-hint", challenge, predicateId: predicate.id });
  }

  function closeHintChallenge(roundId: number, challengeId: string) {
    const challenge = currentState().hintChallenge;
    if (
      !challenge ||
      challenge.roundId !== roundId ||
      challenge.challengeId !== challengeId
    )
      return;
    pendingFocusRef.current = "hint";
    completedChallengeRef.current = null;
    dispatch({
      type: "close-hint-challenge",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
    });
  }

  function submitHintAnswer(
    roundId: number,
    challengeId: string,
    answer: number | null,
  ) {
    const latestState = currentState();
    const challenge = latestState.hintChallenge;
    if (
      !challenge ||
      latestState.phase !== "playing" ||
      latestState.revealedMathAnswer !== null ||
      !latestState.activeHintPredicateId ||
      challenge.roundId !== roundId ||
      challenge.challengeId !== challengeId
    )
      return;
    const identity = `${challenge.roundId}:${challenge.challengeId}`;
    if (answer === challenge.expectedAnswer) {
      if (completedChallengeRef.current === identity) return;
      completedChallengeRef.current = identity;
      pendingFocusRef.current = "hint";
      setHintSuccessPending({
        challenge,
        previousAwardedFactId: latestState.latestAwardedFactId,
      });
    }
    dispatch({
      type: "submit-hint-answer",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
      answer,
    });
  }

  function completeHintSuccess(
    roundId: number,
    challengeId: string,
    latestAwardedFactId: string,
  ) {
    setHintSuccessPresentation((current) =>
      current &&
      current.roundId === roundId &&
      current.challengeId === challengeId &&
      current.latestAwardedFactId === latestAwardedFactId
        ? null
        : current,
    );
  }

  function giveUpHintChallenge(roundId: number, challengeId: string) {
    const challenge = currentState().hintChallenge;
    if (
      !challenge ||
      challenge.roundId !== roundId ||
      challenge.challengeId !== challengeId
    )
      return;
    const identity = `${challenge.roundId}:${challenge.challengeId}`;
    completedChallengeRef.current = identity;
    setHintSuccessPending((pending) =>
      pending &&
      pending.challenge.roundId === challenge.roundId &&
      pending.challenge.challengeId === challenge.challengeId
        ? null
        : pending,
    );
    dispatch({
      type: "give-up-hint-challenge",
      roundId: challenge.roundId,
      challengeId: challenge.challengeId,
    });
    const newHintButton = newHintButtonRef.current;
    if (newHintButton && !newHintButton.disabled && newHintButton.isConnected)
      newHintButton.focus({ preventScroll: true });
  }

  function handleCatEnter() {
    clearPendingHoverTimer();
    if (currentState().phase === "playing")
      dispatch({ type: "set-cat-hover", active: true });
  }

  function handleCatLeave() {
    clearPendingHoverTimer();
    const roundId = currentState().roundId;
    const generation = roundGenerationRef.current;
    pendingHoverTimerRef.current = setTimeout(() => {
      const latestState = stateRef.current;
      if (
        latestState &&
        roundGenerationRef.current === generation &&
        latestState.phase === "playing" &&
        latestState.roundId === roundId
      ) {
        dispatch({ type: "set-cat-hover", active: false });
      }
    }, 250);
  }

  return {
    state,
    hintSuccessPresentation,
    hintSuccessPending,
    inputRef,
    hintButtonRef,
    historyButtonRef,
    newGameButtonRef,
    newHintButtonRef,
    dialAngle,
    titleRun,
    startNewRound,
    submitGuess,
    changeGuessInput,
    surrenderRound,
    toggleHistory,
    showHint,
    replaceHintChallenge,
    closeHintChallenge,
    submitHintAnswer,
    completeHintSuccess,
    giveUpHintChallenge,
    handleCatEnter,
    handleCatLeave,
  };
}
