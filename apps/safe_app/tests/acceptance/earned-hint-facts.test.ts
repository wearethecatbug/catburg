import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicCandidateCodes,
  chooseNextHintPredicate,
  evaluateEarnedHintFact,
  filterCandidateCodesByFact,
} from "@/features/safe-game/domain/earned-hint-facts";
import type {
  EarnedHintFact,
  HintPredicate,
} from "@/features/safe-game/domain/earned-hint-facts";

function assertEligiblePredicate(
  candidates: number[],
  predicate: HintPredicate,
) {
  const matching = candidates.filter((candidate) =>
    predicate.matches(candidate),
  );
  const nonmatching = candidates.filter(
    (candidate) => !predicate.matches(candidate),
  );

  assert.ok(
    matching.length >= 2,
    "the true outcome must retain at least two public candidates",
  );
  assert.ok(
    nonmatching.length >= 2,
    "the false outcome must retain at least two public candidates",
  );
  assert.ok(
    matching.length < candidates.length,
    "the true outcome must strictly reduce candidates",
  );
  assert.ok(
    nonmatching.length < candidates.length,
    "the false outcome must strictly reduce candidates",
  );
}

function factFor(predicate: HintPredicate, code: number) {
  return evaluateEarnedHintFact(predicate, code);
}

function serializablePredicateMetadata(predicate: HintPredicate) {
  if (predicate.kind === "divisibility")
    return {
      id: predicate.id,
      kind: predicate.kind,
      divisor: predicate.divisor,
    };
  if (predicate.kind === "range")
    return {
      id: predicate.id,
      kind: predicate.kind,
      threshold: predicate.threshold,
    };
  return { id: predicate.id, kind: predicate.kind };
}

test("SC04 facts: availability and predicate choice use only disclosed facts and distinct wrong attempts", () => {
  const publicKnowledge = {
    facts: [] as EarnedHintFact[],
    wrongAttempts: [17, 17, 1001, 0, 44],
    issuedPredicateIds: [] as string[],
  };
  const candidates = buildPublicCandidateCodes(publicKnowledge);

  assert.equal(
    candidates.length,
    998,
    "only distinct in-range wrong attempts eliminate their own values",
  );
  assert.equal(candidates.includes(17), false);
  assert.equal(candidates.includes(44), false);

  const first = chooseNextHintPredicate(publicKnowledge);
  assert.ok(
    first,
    "a public candidate set with eligible partitions must offer a predicate",
  );
  assertEligiblePredicate(candidates, first);

  // There is deliberately no secret argument: equivalent public knowledge selects the same
  // serializable predicate metadata and candidate branches, not the same callback object.
  const repeated = chooseNextHintPredicate(publicKnowledge);
  assert.ok(repeated);
  assert.deepEqual(
    serializablePredicateMetadata(repeated),
    serializablePredicateMetadata(first),
  );
  assert.deepEqual(
    candidates.filter(repeated.matches),
    candidates.filter(first.matches),
    "equivalent public knowledge must preserve the same true branch even when each predicate owns a new callback",
  );
  assert.deepEqual(
    candidates.filter((candidate) => !repeated.matches(candidate)),
    candidates.filter((candidate) => !first.matches(candidate)),
  );
});

test("SC04 facts: each awarded typed fact is truthful, useful, noncontradictory, and ordered independently of the secret", () => {
  const first = chooseNextHintPredicate({
    facts: [],
    wrongAttempts: [],
    issuedPredicateIds: [],
  });
  assert.ok(first);
  const firstFact = factFor(first, 42);
  const afterFirst = buildPublicCandidateCodes({
    facts: [firstFact],
    wrongAttempts: [],
  });

  assert.ok(
    afterFirst.length < 1000,
    "an award must strictly reduce the public set",
  );
  assert.ok(
    afterFirst.includes(42),
    "the award must retain the compatible code",
  );
  assert.deepEqual(
    afterFirst,
    filterCandidateCodesByFact(
      [...Array(1000)].map((_, index) => index + 1),
      firstFact,
    ),
  );

  const next = chooseNextHintPredicate({
    facts: [firstFact],
    wrongAttempts: [],
    issuedPredicateIds: [first.id],
  });
  assert.ok(
    next,
    "a second eligible predicate must be selected instead of replaying the first one",
  );
  assert.notEqual(next.id, first.id);
  assertEligiblePredicate(afterFirst, next);

  const nextFact = factFor(next, 42);
  const accumulated = buildPublicCandidateCodes({
    facts: [firstFact, nextFact],
    wrongAttempts: [],
  });
  assert.ok(accumulated.includes(42));
  assert.ok(
    accumulated.length < afterFirst.length,
    "accumulated rewards cannot be implied or zero-value",
  );
  assert.equal(
    new Set([firstFact.id, nextFact.id]).size,
    2,
    "awarded facts require stable non-duplicated identities",
  );
});

test("SC04 facts: policy cycles parity, divisibility, range, then resumes eligible divisors with deterministic ties and exhaustion", () => {
  const initial = {
    facts: [] as EarnedHintFact[],
    wrongAttempts: [],
    issuedPredicateIds: [] as string[],
  };
  const parity = chooseNextHintPredicate(initial);
  assert.deepEqual(parity?.kind, "parity", "parity is the first family");

  const parityFact = factFor(parity!, 42);
  const afterParity = {
    facts: [parityFact],
    wrongAttempts: [],
    issuedPredicateIds: [parity!.id],
  };
  const firstDivisibility = chooseNextHintPredicate(afterParity);
  assert.equal(firstDivisibility?.id, "divisibility:3");
  assert.equal(firstDivisibility?.divisor, 3);

  const divisors = [3, 5, 7, 11, 13];
  const divisorFact = factFor(firstDivisibility!, 42);
  const range = chooseNextHintPredicate({
    facts: [parityFact, divisorFact],
    wrongAttempts: [],
    issuedPredicateIds: [parity!.id, firstDivisibility!.id],
  });
  assert.equal(range?.kind, "range");
  assert.equal(
    range?.threshold,
    500,
    "a median tie selects the lower ten-grid threshold after the first divisor",
  );

  const rangeFact = factFor(range!, 42);
  const resumedDivisibility = chooseNextHintPredicate({
    facts: [parityFact, divisorFact, rangeFact],
    wrongAttempts: [],
    issuedPredicateIds: [parity!.id, firstDivisibility!.id, range!.id],
  });
  assert.equal(
    resumedDivisibility?.kind,
    "divisibility",
    "after range, exhausted parity is skipped and the next family resumes",
  );
  assert.equal(
    resumedDivisibility?.divisor,
    divisors[1],
    "divisor order remains fixed when the cycle resumes",
  );

  const exhaustedRangeIds = Array.from(
    { length: 99 },
    (_, index) => `range:${(index + 1) * 10}`,
  );
  for (let index = 0; index < divisors.length; index += 1) {
    const predicate = chooseNextHintPredicate({
      facts: [],
      wrongAttempts: [],
      issuedPredicateIds: [
        parity!.id,
        ...exhaustedRangeIds,
        ...divisors.slice(0, index).map((divisor) => `divisibility:${divisor}`),
      ],
    });
    assert.equal(predicate?.kind, "divisibility");
    assert.equal(
      predicate?.divisor,
      divisors[index],
      "skipping an exhausted family must not reorder divisors",
    );
  }

  const exhausted = chooseNextHintPredicate({
    facts: [],
    wrongAttempts: [],
    issuedPredicateIds: [
      parity!.id,
      ...divisors.map((divisor) => `divisibility:${divisor}`),
      ...exhaustedRangeIds,
    ],
  });
  assert.equal(
    exhausted,
    null,
    "finite policy exhaustion offers no math challenge",
  );
});
