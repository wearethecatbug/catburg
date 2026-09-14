import { chooseNextHintPredicate } from "../domain";
import type {
  CatReaction,
  EarnedHintFact,
  SafeGameState,
  SafeHint,
} from "../domain";

/** Terminal phase takes precedence over transient cat hover and previous feedback. */
export function selectTerminalPresentation(state: SafeGameState): {
  safeOpen: boolean;
  catReaction: CatReaction;
  revealedCode: number | null;
} {
  if (state.phase === "won")
    return { safeOpen: true, catReaction: "won", revealedCode: null };
  if (state.phase === "surrendered")
    return {
      safeOpen: false,
      catReaction: "surrendered",
      revealedCode: state.code,
    };
  return {
    safeOpen: false,
    catReaction: state.catReaction,
    revealedCode: null,
  };
}

export function selectHintText(hint: SafeHint | null) {
  return hint === "even"
    ? "The code is even."
    : hint === "odd"
      ? "The code is odd."
      : null;
}

/** Public presentation handoff: round identity and disclosed facts only. */
export function selectEarnedHintReadModel(state: SafeGameState): {
  roundId: number;
  facts: readonly EarnedHintFact[];
  latestAwardedFactId: string | null;
} {
  return {
    roundId: state.roundId,
    facts: state.earnedHintFacts,
    latestAwardedFactId: state.latestAwardedFactId,
  };
}

function formatEarnedFact(fact: EarnedHintFact): string {
  if (fact.kind === "parity") return `Earned hint: The code is ${fact.parity}.`;
  if (fact.kind === "divisibility") {
    return fact.relation === "divisible"
      ? `Earned hint: The code is divisible by ${fact.divisor}.`
      : `Earned hint: The code is not divisible by ${fact.divisor}.`;
  }
  return `Earned hint: The code is between ${fact.minimum} and ${fact.maximum}.`;
}

/**
 * The status surface derives availability from public state fields and never reads the private
 * code.
 */
export function selectEarnedHintStatusText(
  state: SafeGameState,
): string | null {
  return selectEarnedHintPresentation(state).statusText;
}

export function selectEarnedHintPresentation(state: SafeGameState): {
  statusText: string | null;
  hintsExhausted: boolean;
} {
  const readModel = selectEarnedHintReadModel(state);
  const latestFact =
    readModel.latestAwardedFactId === null
      ? null
      : (readModel.facts.find(
          (fact) => fact.id === readModel.latestAwardedFactId,
        ) ?? null);
  const legacyHint = latestFact ? null : selectHintText(state.shownHint);
  const exhausted = selectHintsExhausted(state);
  const messages = [
    latestFact ? formatEarnedFact(latestFact) : legacyHint,
    exhausted ? "No further hints are available." : null,
  ].filter((message): message is string => message !== null);
  return {
    statusText: messages.length ? messages.join(" ") : null,
    hintsExhausted: exhausted,
  };
}

/** Availability uses only public round progress; the secret code never affects the menu message. */
export function selectHintsExhausted(state: SafeGameState): boolean {
  return (
    state.phase === "playing" &&
    !state.hintChallenge &&
    chooseNextHintPredicate({
      facts: state.earnedHintFacts,
      wrongAttempts: state.attempts,
      issuedPredicateIds: state.issuedHintPredicateIds,
    }) === null
  );
}
