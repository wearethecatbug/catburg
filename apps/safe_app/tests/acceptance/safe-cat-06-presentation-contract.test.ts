import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const dialogSource = readFileSync(
  resolve(
    process.cwd(),
    "src/features/safe-game/presentation/hint-challenge-dialog.tsx",
  ),
  "utf8",
);
const dialogStyles = readFileSync(
  resolve(
    process.cwd(),
    "src/features/safe-game/presentation/hint-challenge-dialog.module.css",
  ),
  "utf8",
);
const screenSource = readFileSync(
  resolve(
    process.cwd(),
    "src/features/safe-game/presentation/safe-game-screen.tsx",
  ),
  "utf8",
);
const screenStyles = readFileSync(
  resolve(
    process.cwd(),
    "src/features/safe-game/presentation/safe-game-screen.module.css",
  ),
  "utf8",
);

test("SC06 presentation: the public dialog keeps the approved action labels and accessible modal boundary", () => {
  assert.match(dialogSource, /role="dialog"/);
  assert.match(dialogSource, /aria-modal="true"/);
  assert.match(
    dialogSource,
    />Check<|>Check\s*<\/button>/,
    "the accepted-answer action is named Check",
  );
  assert.match(
    dialogSource,
    />New question<|>New question\s*<\/span>/,
    "challenge replacement is named New question",
  );
  assert.match(
    dialogSource,
    />Give up<|>Give up\s*<\/span>/,
    "math abandonment is named Give up",
  );
  assert.match(
    dialogSource,
    /Random operator/,
    "the fifth accessible action is named Random operator",
  );
  assert.match(
    dialogSource,
    /placeholder="Enter your answer…"/,
    "the answer field has the approved visible placeholder",
  );
  assert.match(
    dialogSource,
    /Choose which operations can appear in the examples\./,
    "the operation picker exposes its approved helper text",
  );
  assert.match(
    dialogSource,
    /<svg[\s\S]*?aria-hidden="true"/,
    "the labelled action surface contains decorative inline SVG markup",
  );
});

test("SC06 presentation: the approved cat bubble is decorative and non-announcing", () => {
  assert.match(
    dialogSource,
    /Solve this and I’ll give you a hint!/,
    "the approved decorative cat bubble copy is present",
  );
  assert.match(
    dialogSource,
    /revealedMathAnswer/,
    "Give up derives its public math answer from the active revealed math answer",
  );
  assert.match(
    dialogSource,
    /No worries — try another one!/,
    "Give up has the approved answer-aware encouraging decorative cat bubble copy",
  );
  assert.match(
    dialogSource,
    /aria-hidden="true"/,
    "the cat bubble is contained in a decorative, non-announcing layer",
  );
});

test("SC06 presentation: Give up conditionally removes only the popup lamp from the abandoned vignette", () => {
  assert.match(
    dialogSource,
    /!abandoned[\s\S]{0,240}hint-popup-lamp-320\.png/,
    "the lamp asset is governed by an explicit non-abandoned conditional",
  );
});

test("SC06 presentation: a rejected math answer has one decorative retry bubble and one separate polite announcement", () => {
  assert.match(
    dialogSource,
    /aria-invalid/,
    "the public hint answer supports an accessible invalid state",
  );
  assert.match(
    dialogSource,
    /Try again — you’ve got this!/,
    "the exact retry encouragement copy is present",
  );
  assert.match(
    dialogSource,
    /role=\{[^}]*status[^}]*\}|role="status"/,
    "retry feedback retains a polite status owner outside decorative artwork",
  );
  assert.match(
    dialogStyles,
    /(invalid|error|retry)/i,
    "dialog styles define a bounded invalid-answer treatment",
  );
});

test("SC06 presentation: the resolved challenge states are explicit and do not turn decorative artwork into secret disclosure", () => {
  for (const state of ["thinking", "concerned", "sad", "happy"]) {
    assert.match(
      dialogSource,
      new RegExp(state, "i"),
      `the ${state} cat state is selected by the dialog presentation`,
    );
  }
  assert.doesNotMatch(
    dialogSource,
    /code\s*[:=]|revealedCode|state\.code/i,
    "dialog presentation must not render the Safe Cat secret",
  );
});

test("SC06 presentation: one unresolved challenge reaches concerned at 10,000 ms without a presentation-owned game-domain mutation", () => {
  assert.match(
    dialogSource,
    /10_?000/,
    "the unresolved visual deadline is exactly 10,000 ms",
  );
  assert.doesNotMatch(
    dialogSource,
    /dispatch\s*\(/,
    "the dialog does not mutate game-domain state to change decorative timeout artwork",
  );
});

test("SC06 presentation: accepted success remains modal during a synchronized 2,500 ms popup and backdrop fade", () => {
  assert.match(dialogSource, /2_?500/, "success timing is exactly 2,500 ms");
  assert.match(
    dialogSource,
    /happy/i,
    "the accepted-success visual selects the happy cat",
  );
  assert.match(
    dialogSource,
    /Great job! You earned a hint!/,
    "accepted success has the approved decorative cat congratulation copy",
  );
  assert.match(
    dialogStyles,
    /opacity/i,
    "the dialog stylesheet defines an opacity transition state",
  );
  assert.match(
    dialogStyles,
    /backdrop/i,
    "the popup backdrop participates in the same presentation contract",
  );
});

test("SC06 presentation: a reward owns the sole cat/safe-top slot instead of stacking a normal CatAvatar", () => {
  assert.match(
    screenSource,
    /reward/i,
    "screen renders the public reward presentation",
  );
  assert.match(
    screenSource,
    /CatAvatar/,
    "screen retains normal cat presentation outside reward state",
  );
  assert.match(
    screenSource,
    /!reward|reward\s*\?/,
    "screen conditionally replaces the normal cat while reward is visible",
  );
});

test("SC06 presentation: both reward and popup vignette use the approved comic speech language", () => {
  assert.match(
    screenStyles,
    /reward/i,
    "screen styles own the reward composition",
  );
  assert.match(
    dialogStyles,
    /border-radius/i,
    "dialog styles define rounded comic speech geometry",
  );
  assert.match(
    dialogStyles,
    /::after/i,
    "dialog styles define a visible speech-tail pseudo-element",
  );
});

test("SC06 presentation: opening a dialog locks document scrolling and closing it restores the pre-open position", () => {
  assert.match(
    screenSource,
    /scroll/i,
    "screen presentation owns a bounded scroll integration",
  );
  assert.match(
    screenSource,
    /overflow/i,
    "screen presentation records the document scroll lock",
  );
  assert.match(
    screenStyles,
    /safeGameScreen/,
    "the tested screen owns the stable underlying stage",
  );
});

test("SC06 presentation: three responsive ranges keep an internally scrollable, framed dialog", () => {
  assert.match(
    dialogStyles,
    /overflow\s*:\s*auto/,
    "short dialog content remains internally scrollable",
  );
  assert.match(
    dialogStyles,
    /hint-popup-background-1327\.png/,
    "the approved 1327x1185 popup background is painted by the dialog",
  );
  assert.doesNotMatch(
    dialogStyles,
    /hint-popup-frame-1448\.png|border-image/i,
    "the old 1448px frame and independently sliced border treatment are not the popup background contract",
  );
  assert.match(
    dialogStyles,
    /@media\s*\(min-width:\s*1280px\)/,
    "desktop treatment begins at 1280px",
  );
  assert.match(
    dialogStyles,
    /@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*1279px\)/,
    "tablet treatment covers 601px through 1279px",
  );
  assert.match(
    dialogStyles,
    /@media\s*\(max-width:\s*600px\)/,
    "mobile treatment covers 600px and below",
  );
});
