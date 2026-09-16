"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import {
  chooseNextHintPredicate,
  createHintChallenge,
  createSafeGameState,
  defaultRoundSource,
  normalizeSafeGuess,
  reduceSafeGame,
  type EarnedHintFact,
  type HintOperator,
  type RoundSource,
  type SafeGameAction,
  type SafeGameState,
} from "../domain";
import { createChallengeId } from "./challenge-id";
import { usePresentationMachine } from "./use-presentation-machine";

type FocusTarget = "hint" | "history" | "input" | "new-game" | null;
type GuessInputEditIntent = "delete" | "insert";

function factText(fact: EarnedHintFact) {
  if (fact.kind === "parity") return `The code is ${fact.parity}.`;
  if (fact.kind === "divisibility") return fact.relation === "divisible" ? `The code is divisible by ${fact.divisor}.` : `The code is not divisible by ${fact.divisor}.`;
  return `The code is between ${fact.minimum} and ${fact.maximum}.`;
}

function initialState(source: RoundSource) {
  return createSafeGameState(source.nextCode());
}

/** Sanitized domain-to-presentation adapter. Domain never stores visual state or timers. */
export function useGameController(roundSource: RoundSource = defaultRoundSource) {
  const [state, dispatch] = useReducer<SafeGameState, RoundSource, [SafeGameAction]>(reduceSafeGame, roundSource, initialState);
  const stateRef = useRef(state);
  const inputRevision = useRef(0);
  const pendingFocus = useRef<FocusTarget>("input");
  const retainHintFocusThroughReward = useRef(false);
  const suppressRestoredHintFocus = useRef(false);
  const suppressStoredEscapeRestore = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hintButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  const newGameButtonRef = useRef<HTMLButtonElement | null>(null);
  const newHintButtonRef = useRef<HTMLButtonElement | null>(null);
  const challengeRef = useRef<import("../domain").HintChallenge | null>(null);
  const [dialAngle, setDialAngle] = useState(0);
  const [titleRun, setTitleRun] = useState(0);
  const { presentation, send } = usePresentationMachine(state.roundId);

  useLayoutEffect(() => { stateRef.current = state; }, [state]);

  const focus = (target: FocusTarget) => {
    const node = target === "hint" ? hintButtonRef.current : target === "history" ? historyButtonRef.current : target === "new-game" ? newGameButtonRef.current : inputRef.current;
    if (node && !node.disabled && node.isConnected) node.focus({ preventScroll: true });
  };
  const focusRestoredHint = () => {
    suppressRestoredHintFocus.current = true;
    try {
      focus("hint");
    } finally {
      suppressRestoredHintFocus.current = false;
    }
  };
  useLayoutEffect(() => {
    if (pendingFocus.current === "history" && presentation.surface === "none") {
      suppressStoredEscapeRestore.current = false;
      focus("history");
    } else if (state.phase !== "playing" && presentation.mode !== "HISTORY") {
      suppressStoredEscapeRestore.current = false;
      focus("new-game");
    }
    else if (pendingFocus.current === "hint" && presentation.mode === "HINT_REWARD") {
      focusRestoredHint();
      retainHintFocusThroughReward.current = true;
    } else if (presentation.surface === "none") {
      if (retainHintFocusThroughReward.current) retainHintFocusThroughReward.current = false;
      else if (pendingFocus.current === "hint" && suppressStoredEscapeRestore.current) {
        suppressStoredEscapeRestore.current = false;
        focusRestoredHint();
      } else {
        suppressStoredEscapeRestore.current = false;
        focus(pendingFocus.current ?? "input");
      }
    }
    pendingFocus.current = null;
  }, [presentation.surface, state.phase, state.roundId]);
  useEffect(() => {
    if (presentation.mode === "HINT_REWARD") challengeRef.current = null;
  }, [presentation.mode]);

  function startNewRound() {
    const roundEpoch = stateRef.current.roundId + 1;
    retainHintFocusThroughReward.current = false; pendingFocus.current = "input"; inputRevision.current = 0; challengeRef.current = null; setDialAngle(0); setTitleRun((value) => value + 1);
    dispatch({ type: "new-round", code: roundSource.nextCode() });
    send({ type: "ROUND_STARTED", roundEpoch });
  }
  function submitGuess() {
    const current = stateRef.current;
    if (current.phase !== "playing" || current.hintChallenge) return;
    retainHintFocusThroughReward.current = false;
    const guess = normalizeSafeGuess(current.input);
    dispatch({ type: "submit-guess" });
    if (guess.valid) send(guess.value === current.code ? { type: "ROUND_WON", roundEpoch: current.roundId } : { type: "VALID_WRONG_GUESS", roundEpoch: current.roundId });
  }
  function changeGuessInput(input: string, intent: GuessInputEditIntent = "insert") {
    const current = stateRef.current;
    if (input !== current.input) {
      retainHintFocusThroughReward.current = false;
      inputRevision.current += 1;
      setDialAngle((angle) => input === "" ? 0 : intent === "delete" ? angle - 36 : angle + 36);
      send({ type: "INPUT_VALUE_CHANGED", roundEpoch: current.roundId, inputRevision: inputRevision.current });
    }
    dispatch({ type: "set-input", input });
  }
  function surrenderRound() {
    const current = stateRef.current;
    if (current.phase !== "playing") return;
    retainHintFocusThroughReward.current = false; pendingFocus.current = "new-game"; challengeRef.current = null; dispatch({ type: "surrender" }); send({ type: "ROUND_SURRENDERED", roundEpoch: current.roundId });
  }
  function toggleHistory() {
    retainHintFocusThroughReward.current = false;
    if (presentation.mode === "HISTORY") pendingFocus.current = "history";
    send({ type: "HISTORY_TOGGLE", roundEpoch: stateRef.current.roundId });
  }
  function showHint() {
    const current = stateRef.current;
    if (current.phase !== "playing") return;
    retainHintFocusThroughReward.current = false;
    const predicate = chooseNextHintPredicate({ facts: current.earnedHintFacts, wrongAttempts: current.attempts, issuedPredicateIds: current.issuedHintPredicateIds });
    if (!predicate) return;
    const challenge = createHintChallenge(Math.random, current.roundId, "+", createChallengeId(Math.random, Date.now, globalThis.crypto?.randomUUID?.bind(globalThis.crypto)));
    challengeRef.current = challenge;
    dispatch({ type: "show-hint", challenge, predicateId: predicate.id });
    send({ type: "HINT_DIALOG_OPEN", roundEpoch: current.roundId, challengeId: challenge.challengeId });
  }
  function replaceHintChallenge(roundId: number, challengeId: string, operator: HintOperator) {
    const current = stateRef.current; const active = current.hintChallenge;
    if (!active || active.roundId !== roundId || active.challengeId !== challengeId) return;
    const predicate = chooseNextHintPredicate({ facts: current.earnedHintFacts, wrongAttempts: current.attempts, issuedPredicateIds: current.issuedHintPredicateIds });
    if (!predicate) return;
    const challenge = createHintChallenge(Math.random, roundId, operator, createChallengeId(Math.random, Date.now, globalThis.crypto?.randomUUID?.bind(globalThis.crypto)));
    challengeRef.current = challenge;
    dispatch({ type: "close-hint-challenge", roundId, challengeId }); dispatch({ type: "show-hint", challenge, predicateId: predicate.id });
    send({ type: "HINT_DIALOG_OPEN", roundEpoch: roundId, challengeId: challenge.challengeId });
  }
  function closeHintChallenge(roundId: number, challengeId: string) {
    const current = stateRef.current;
    if (current.hintChallenge?.roundId !== roundId || current.hintChallenge.challengeId !== challengeId) return;
    pendingFocus.current = "hint"; dispatch({ type: "close-hint-challenge", roundId, challengeId }); send({ type: "HINT_DIALOG_CLOSED", roundEpoch: roundId, challengeId });
    challengeRef.current = null;
  }
  function submitHintAnswer(roundId: number, challengeId: string, answer: number | null) {
    const current = stateRef.current; const active = current.hintChallenge;
    if (!active || active.roundId !== roundId || active.challengeId !== challengeId) return;
    const action: SafeGameAction = { type: "submit-hint-answer", roundId, challengeId, answer };
    const next = reduceSafeGame(current, action); dispatch(action);
    const award = next.earnedHintFacts.at(-1);
    if (award && award.id !== current.latestAwardedFactId) {
      pendingFocus.current = "hint";
      send({ type: "HINT_AWARDED", roundEpoch: roundId, challengeId, award: { factId: award.id, text: factText(award) } });
    }
  }
  function completeHintSuccess(roundId: number, challengeId: string, factId: string, cause: "close" | "escape" = "close") { send({ type: "HINT_SUCCESS_COMPLETE_EARLY", roundEpoch: roundId, challengeId, factId, cause }); }
  function giveUpHintChallenge(roundId: number, challengeId: string) { dispatch({ type: "give-up-hint-challenge", roundId, challengeId }); }
  function showHintFocus() {
    if (suppressRestoredHintFocus.current) return;
    retainHintFocusThroughReward.current = false;
    send({ type: "SHOW_HINT_FOCUS", roundEpoch: round() });
  }
  function showHintEnter() {
    retainHintFocusThroughReward.current = false;
    send({ type: "SHOW_HINT_ENTER", roundEpoch: round() });
  }
  function showHintTouchStart() {
    retainHintFocusThroughReward.current = false;
    send({ type: "SHOW_HINT_TOUCH_START", roundEpoch: round() });
  }

  const round = () => stateRef.current.roundId;
  return {
    state, presentation, presentationChallenge: challengeRef.current, inputRef, hintButtonRef, historyButtonRef, newGameButtonRef, newHintButtonRef, dialAngle, titleRun,
    startNewRound, submitGuess, changeGuessInput, surrenderRound, toggleHistory, showHint, replaceHintChallenge, closeHintChallenge, submitHintAnswer, completeHintSuccess, giveUpHintChallenge,
    catPetStart: (modality: "pointer" | "keyboard" | "touch") => send({ type: "CAT_PET_START", roundEpoch: round(), modality }),
    catPetEnd: (stateEpoch: number) => send({ type: "CAT_PET_END", roundEpoch: round(), stateEpoch }),
    showHintEnter, showHintFocus, showHintTouchStart,
    showHintLeave: () => send({ type: "SHOW_HINT_LEAVE", roundEpoch: round() }),
    storedHintsEscape: () => {
      if (presentation.mode === "STORED_HINTS") {
        pendingFocus.current = "hint";
        suppressStoredEscapeRestore.current = true;
      }
      send({ type: "STORED_HINTS_ESCAPE", roundEpoch: round() });
    },
    historyActivity: () => send({ type: "HISTORY_ACTIVITY", roundEpoch: round() }),
  };
}
