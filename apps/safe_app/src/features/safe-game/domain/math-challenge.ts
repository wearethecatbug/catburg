import type { HintChallenge, HintOperator } from "./game.types";

export function hasChallengeId(challengeId: unknown): challengeId is string {
  return typeof challengeId === "string" && challengeId.trim().length > 0;
}

function isOperand(value: number, maximum = 10) {
  return Number.isInteger(value) && value >= 1 && value <= maximum;
}

/** Confirms that an externally supplied challenge has the same bounds and equation as the generator. */
export function isValidHintChallenge(challenge: HintChallenge) {
  if (!hasChallengeId(challenge.challengeId)) return false;

  switch (challenge.operator) {
    case "+":
      return (
        isOperand(challenge.leftOperand) &&
        isOperand(challenge.rightOperand) &&
        challenge.expectedAnswer ===
          challenge.leftOperand + challenge.rightOperand
      );
    case "-":
      return (
        isOperand(challenge.leftOperand) &&
        isOperand(challenge.rightOperand) &&
        challenge.leftOperand >= challenge.rightOperand &&
        challenge.expectedAnswer ===
          challenge.leftOperand - challenge.rightOperand
      );
    case "×":
      return (
        isOperand(challenge.leftOperand) &&
        isOperand(challenge.rightOperand) &&
        challenge.expectedAnswer ===
          challenge.leftOperand * challenge.rightOperand
      );
    case "÷":
      return (
        isOperand(challenge.leftOperand, 100) &&
        isOperand(challenge.rightOperand) &&
        isOperand(challenge.expectedAnswer) &&
        challenge.leftOperand ===
          challenge.rightOperand * challenge.expectedAnswer
      );
    default:
      return false;
  }
}

/**
 * With random values in [0, 1), subtraction stays nonnegative and division is exact with a
 * nonzero divisor.
 */
export function createHintChallenge(
  random: () => number,
  roundId: number,
  operator: HintOperator,
  challengeId: string,
): HintChallenge {
  if (!hasChallengeId(challengeId)) {
    throw new RangeError("Hint challenge identity must be a non-empty string.");
  }

  const createOperand = () => 1 + Math.floor(random() * 10);
  const firstOperand = createOperand();
  const secondOperand = createOperand();
  let leftOperand = firstOperand;
  let rightOperand = secondOperand;
  let expectedAnswer = firstOperand + secondOperand;

  if (operator === "-") {
    leftOperand = Math.max(firstOperand, secondOperand);
    rightOperand = Math.min(firstOperand, secondOperand);
    expectedAnswer = leftOperand - rightOperand;
  } else if (operator === "×") {
    expectedAnswer = firstOperand * secondOperand;
  } else if (operator === "÷") {
    leftOperand = firstOperand * secondOperand;
    expectedAnswer = firstOperand;
  }

  return {
    roundId,
    challengeId,
    operator,
    leftOperand,
    rightOperand,
    expectedAnswer,
  };
}
