import type { HintChallenge, HintOperator } from "./game.types";

export function hasChallengeId(challengeId: unknown): challengeId is string {
  return typeof challengeId === "string" && challengeId.trim().length > 0;
}

function isOperand(value: unknown, maximum = 10): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= maximum
  );
}

function isRoundId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Confirms that an externally supplied challenge has the same bounds and equation as the generator. */
export function isValidHintChallenge(
  challenge: unknown,
): challenge is HintChallenge {
  if (!challenge || typeof challenge !== "object") return false;
  const {
    challengeId,
    expectedAnswer,
    leftOperand,
    operator,
    rightOperand,
    roundId,
  } = challenge as Partial<HintChallenge>;
  if (!isRoundId(roundId) || !hasChallengeId(challengeId)) return false;

  switch (operator) {
    case "+":
      return (
        isOperand(leftOperand) &&
        isOperand(rightOperand) &&
        expectedAnswer === leftOperand + rightOperand
      );
    case "-":
      return (
        isOperand(leftOperand) &&
        isOperand(rightOperand) &&
        leftOperand >= rightOperand &&
        expectedAnswer === leftOperand - rightOperand
      );
    case "×":
      return (
        isOperand(leftOperand) &&
        isOperand(rightOperand) &&
        expectedAnswer === leftOperand * rightOperand
      );
    case "÷":
      return (
        isOperand(leftOperand, 100) &&
        isOperand(rightOperand) &&
        isOperand(expectedAnswer) &&
        leftOperand === rightOperand * expectedAnswer
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
