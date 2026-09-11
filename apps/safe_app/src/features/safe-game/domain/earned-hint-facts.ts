import { SAFE_CODE_MAXIMUM, SAFE_CODE_MINIMUM } from "./game.types";

export type EarnedHintFact =
  | { id: string; predicateId: string; kind: "parity"; parity: "even" | "odd" }
  | { id: string; predicateId: string; kind: "divisibility"; divisor: number; relation: "divisible" | "not-divisible" }
  | { id: string; predicateId: string; kind: "range"; minimum: number; maximum: number };

export type HintPredicate =
  | { id: "parity"; kind: "parity"; matches: (code: number) => boolean }
  | { id: `divisibility:${number}`; kind: "divisibility"; divisor: number; matches: (code: number) => boolean }
  | { id: `range:${number}`; kind: "range"; threshold: number; matches: (code: number) => boolean };

export interface PublicHintKnowledge {
  facts: readonly EarnedHintFact[];
  wrongAttempts: readonly number[];
  issuedPredicateIds: readonly string[];
}

const DIVISORS = [3, 5, 7, 11, 13] as const;
const RANGE_THRESHOLDS = Array.from({ length: 99 }, (_, index) => (index + 1) * 10);
// Fixed public family order; an exhausted family is skipped for the current request.
const FAMILY_ORDER = ["parity", "divisibility", "range"] as const;
type PredicateFamily = typeof FAMILY_ORDER[number];

function isSafeCode(value: number): boolean {
  return Number.isInteger(value) && value >= SAFE_CODE_MINIMUM && value <= SAFE_CODE_MAXIMUM;
}

function predicateIdFromFact(fact: EarnedHintFact): string {
  return fact.predicateId || fact.id.replace(/^round:\d+:fact:\d+:/, "");
}

function issuedPredicateSet(knowledge: PublicHintKnowledge): Set<string> {
  return new Set([...knowledge.issuedPredicateIds, ...knowledge.facts.map(predicateIdFromFact)]);
}

function predicateFamily(predicateId: string): PredicateFamily | null {
  if (predicateId === "parity") return "parity";
  if (predicateId.startsWith("divisibility:")) return "divisibility";
  if (predicateId.startsWith("range:")) return "range";
  return null;
}

function createParityPredicate(): HintPredicate {
  return { id: "parity", kind: "parity", matches: (code) => code % 2 === 0 };
}

function createDivisibilityPredicate(divisor: number): HintPredicate {
  return { id: `divisibility:${divisor}`, kind: "divisibility", divisor, matches: (code) => code % divisor === 0 };
}

function createRangePredicate(threshold: number): Extract<HintPredicate, { kind: "range" }> {
  return { id: `range:${threshold}`, kind: "range", threshold, matches: (code) => code <= threshold };
}

function isEligible(candidates: readonly number[], predicate: HintPredicate): boolean {
  const matchingCount = candidates.filter(predicate.matches).length;
  const nonMatchingCount = candidates.length - matchingCount;
  return matchingCount >= 2 && nonMatchingCount >= 2 && matchingCount < candidates.length && nonMatchingCount < candidates.length;
}

function median(candidates: readonly number[]): number {
  const middle = Math.floor(candidates.length / 2);
  return candidates.length % 2 === 0 ? (candidates[middle - 1] + candidates[middle]) / 2 : candidates[middle];
}

function eligiblePredicateForFamily(family: PredicateFamily, candidates: readonly number[], issued: Set<string>): HintPredicate | null {
  if (family === "parity") {
    const predicate = createParityPredicate();
    return !issued.has(predicate.id) && isEligible(candidates, predicate) ? predicate : null;
  }

  if (family === "divisibility") {
    for (const divisor of DIVISORS) {
      const predicate = createDivisibilityPredicate(divisor);
      if (!issued.has(predicate.id) && isEligible(candidates, predicate)) return predicate;
    }
    return null;
  }

  const candidateMedian = median(candidates);
  const eligible: Extract<HintPredicate, { kind: "range" }>[] = RANGE_THRESHOLDS
    .map(createRangePredicate)
    .filter((predicate) => !issued.has(predicate.id) && isEligible(candidates, predicate));
  eligible.sort((left, right) => Math.abs(left.threshold - candidateMedian) - Math.abs(right.threshold - candidateMedian) || left.threshold - right.threshold);
  return eligible[0] ?? null;
}

/** Public-only candidate set: earned facts and neutral, distinct wrong attempts are the sole inputs. */
export function buildPublicCandidateCodes(knowledge: Pick<PublicHintKnowledge, "facts" | "wrongAttempts">): number[] {
  const wrongAttempts = new Set(knowledge.wrongAttempts.filter(isSafeCode));
  return Array.from({ length: SAFE_CODE_MAXIMUM }, (_, index) => index + SAFE_CODE_MINIMUM)
    .filter((code) => !wrongAttempts.has(code))
    .filter((code) => knowledge.facts.every((fact) => factMatchesCode(fact, code)));
}

export function filterCandidateCodesByFact(candidates: readonly number[], fact: EarnedHintFact): number[] {
  return candidates.filter((code) => factMatchesCode(fact, code));
}

function factMatchesCode(fact: EarnedHintFact, code: number): boolean {
  if (fact.kind === "parity") return fact.parity === "even" ? code % 2 === 0 : code % 2 !== 0;
  if (fact.kind === "divisibility") return fact.relation === "divisible" ? code % fact.divisor === 0 : code % fact.divisor !== 0;
  return code >= fact.minimum && code <= fact.maximum;
}

/** Selects a finite predicate from public knowledge only; no private code is accepted by this API. */
export function chooseNextHintPredicate(knowledge: PublicHintKnowledge): HintPredicate | null {
  const candidates = buildPublicCandidateCodes(knowledge);
  const issued = issuedPredicateSet(knowledge);
  const lastFamily = [...knowledge.issuedPredicateIds, ...knowledge.facts.map(predicateIdFromFact)]
    .map(predicateFamily)
    .filter((family): family is PredicateFamily => family !== null)
    .at(-1);
  const startIndex = lastFamily ? (FAMILY_ORDER.indexOf(lastFamily) + 1) % FAMILY_ORDER.length : 0;

  for (let offset = 0; offset < FAMILY_ORDER.length; offset += 1) {
    const family = FAMILY_ORDER[(startIndex + offset) % FAMILY_ORDER.length];
    const predicate = eligiblePredicateForFamily(family, candidates, issued);
    if (predicate) return predicate;
  }
  return null;
}

/** Evaluates the private code only after the reducer accepts a correct active challenge; range facts stay within the current public bounds. */
export function evaluateEarnedHintFact(predicate: HintPredicate, code: number, id: string = predicate.id, candidates: readonly number[] = []): EarnedHintFact {
  if (!isSafeCode(code)) throw new RangeError("Safe code must be an integer in the advertised range.");
  if (predicate.kind === "parity") return { id, predicateId: predicate.id, kind: "parity", parity: predicate.matches(code) ? "even" : "odd" };
  if (predicate.kind === "divisibility") return { id, predicateId: predicate.id, kind: "divisibility", divisor: predicate.divisor, relation: predicate.matches(code) ? "divisible" : "not-divisible" };
  const minimum = candidates[0] ?? SAFE_CODE_MINIMUM;
  const maximum = candidates.at(-1) ?? SAFE_CODE_MAXIMUM;
  return predicate.matches(code)
    ? { id, predicateId: predicate.id, kind: "range", minimum, maximum: Math.min(maximum, predicate.threshold) }
    : { id, predicateId: predicate.id, kind: "range", minimum: Math.max(minimum, predicate.threshold + 1), maximum };
}
