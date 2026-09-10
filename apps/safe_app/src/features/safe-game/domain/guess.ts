import { SAFE_CODE_MAXIMUM, SAFE_CODE_MINIMUM } from "./game.types";

/** Whitespace and leading zeroes are accepted; signs, decimals and numeric notation are not. */
export function normalizeSafeGuess(input: string): { valid: true; value: number } | { valid: false } {
  const trimmedInput = input.trim();
  if (!/^\d+$/.test(trimmedInput)) {
    return { valid: false };
  }

  const value = Number(trimmedInput);
  return Number.isSafeInteger(value) && value >= SAFE_CODE_MINIMUM && value <= SAFE_CODE_MAXIMUM
    ? { valid: true, value }
    : { valid: false };
}
