import { generateSafeCode } from "./game.factory";

export type RoundSource = Readonly<{ nextCode: () => number }>;

/** Production source; test fixtures may inject the same narrow interface at the provider edge. */
export const defaultRoundSource: RoundSource = {
  nextCode: () => generateSafeCode(Math.random),
};
