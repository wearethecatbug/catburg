/** The fallback sequence distinguishes questions even when time and random samples repeat. */
export function createChallengeId(
  random: () => number,
  now: () => number,
  randomUuid?: () => string,
) {
  return randomUuid?.() ?? `hint-${now()}-${random().toString(36).slice(2)}-${++fallbackSequence}`;
}
let fallbackSequence = 0;
