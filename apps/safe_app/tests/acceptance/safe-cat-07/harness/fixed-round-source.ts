import type { RoundSource } from "@/features/safe-game/domain/round-source";

/** Immutable test-only source. Production keeps its real random generator. */
export const fixedRoundSource: RoundSource = Object.freeze({ nextCode: () => 500 });
