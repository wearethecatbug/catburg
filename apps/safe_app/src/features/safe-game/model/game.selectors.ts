import type { CatReaction, SafeGameState, SafeHint } from "../domain";

/** Terminal phase takes precedence over transient cat hover and previous feedback. */
export function selectTerminalPresentation(state: SafeGameState): {
  safeOpen: boolean;
  catReaction: CatReaction;
  revealedCode: number | null;
} {
  if (state.phase === "won") return { safeOpen: true, catReaction: "won", revealedCode: null };
  if (state.phase === "surrendered") return { safeOpen: false, catReaction: "surrendered", revealedCode: state.code };
  return { safeOpen: false, catReaction: state.catReaction, revealedCode: null };
}

export function selectHintText(hint: SafeHint | null) {
  return hint === "even" ? "The code is even." : hint === "odd" ? "The code is odd." : null;
}
