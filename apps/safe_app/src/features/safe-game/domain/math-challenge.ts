import type { HintChallenge, HintOperator } from "./game.types";

export function hasChallengeId(challengeId: unknown): challengeId is string {
  return typeof challengeId === "string" && challengeId.trim().length > 0;
}

/** With random values in [0, 1), subtraction stays nonnegative and division is exact with a nonzero divisor. */
export function createHintChallenge(random: () => number, roundId: number, operator: HintOperator, challengeId: string): HintChallenge {
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

  return { roundId, challengeId, operator, leftOperand, rightOperand, expectedAnswer };
}
