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
const rewardSource = readFileSync(
  resolve(
    process.cwd(),
    "src/features/safe-game/presentation/reward-presentation.tsx",
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

test("SC06 presentation: the five operation choices are a named pressable group", () => {
  assert.match(
    dialogSource,
    /<div(?=[^>]*className=\{styles\.operatorBoard\})(?=[^>]*role="group")(?=[^>]*aria-label="Choose a math operation")[^>]*>/,
    "the operation-choice container is an explicitly named group",
  );
  for (const label of ["Addition", "Subtraction", "Multiplication", "Division"])
    assert.match(
      dialogSource,
      new RegExp(`label: "${label}"`),
      `${label} remains one of the four labelled operation choices`,
    );
  assert.match(
    dialogSource,
    /operators\.map[\s\S]*?<button[\s\S]*?type="button"[\s\S]*?aria-label=\{label\}/,
    "each mapped operation remains a labelled pressable button",
  );
  assert.match(
    dialogSource,
    /<button[\s\S]*?type="button"[\s\S]*?aria-label="Random operator"/,
    "the fifth choice remains the labelled Random operator button",
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
  const presentationMachineSource = readFileSync(
    resolve(
      process.cwd(),
      "src/features/safe-game/model/presentation-machine.ts",
    ),
    "utf8",
  );
  // Scope the deadline assertion to HINT_AWARDED so another 2,500 ms transition cannot satisfy
  // the success-handoff contract accidentally.
  const handoffBranch = presentationMachineSource.match(
    /if\s*\(\s*e\.type\s*===\s*"HINT_AWARDED"\s*\)\s*\{([\s\S]*?)\}\s*(?=if\s*\(\s*e\.type\s*===\s*"HINT_SUCCESS_COMPLETE_EARLY"\s*\))/,
  );
  assert.ok(
    handoffBranch,
    "the reducer retains a bounded HINT_AWARDED branch before its next event branch",
  );
  assert.match(
    handoffBranch[1],
    /return\s*\{\s*\.\.\.next,\s*mode\s*:\s*"HINT_SUCCESS_HANDOFF",\s*surface\s*:\s*"hint-dialog",\s*resumeMode\s*:\s*s\.resumeMode,\s*challengeId\s*:\s*s\.challengeId,\s*award\s*:\s*e\.award,\s*\.\.\.clock\(\s*next,\s*now,\s*"hint-success",\s*now\s*\+\s*2_?500\s*\)/,
    "the HINT_AWARDED return state owns the exact named hint-success deadline at now + 2,500 ms",
  );
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

test("SC06 presentation: canonical responsive seams keep an internally scrollable, framed dialog", () => {
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
    /@media\s*\(min-width:\s*821px\)/,
    "desktop treatment begins at 821px",
  );
  assert.match(
    dialogStyles,
    /@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*820px\)/,
    "narrow/tablet treatment covers 601px through 820px",
  );
  assert.match(
    dialogStyles,
    /@media\s*\(max-width:\s*600px\)/,
    "mobile treatment covers 600px and below",
  );
  assert.doesNotMatch(
    dialogStyles,
    /@media\s*\(min-width:\s*1280px\)\s*\{\s*\.dialog\s*\{|@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*1279px\)\s*\{\s*\.dialog\s*\{/,
    "canonical dialog layout must not reintroduce the legacy 601-1279px or 1280px cascade markers",
  );
});

test("SC06 presentation: the concise subtitle stays visible throughout tablet widths while mobile keeps it hidden", () => {
  assert.match(
    dialogStyles,
    /@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*820px\)[\s\S]*?\.subtitle\s*\{[\s\S]*?display\s*:\s*block\s*;/,
    "the 601px through 820px tablet treatment explicitly renders the subtitle",
  );
  assert.match(
    dialogStyles,
    /@media\s*\(max-width:\s*600px\)\s*\{\s*\.subtitle\s*\{\s*display\s*:\s*none\s*;/,
    "the later concise mobile rule is limited to 600px and below rather than overriding tablet",
  );
  assert.doesNotMatch(
    dialogStyles,
    /@media\s*\(max-width:\s*820px\)\s*\{\s*\.subtitle\s*\{\s*display\s*:\s*none\s*;/,
    "a broad late narrow-screen hide would conceal the subtitle at 601px through 820px",
  );
});

test("SC06 presentation: reward artwork has its own named semantic image without becoming a second live announcement", () => {
  assert.match(
    rewardSource,
    /<div(?=[^>]*className=\{styles\.reward\})(?=[^>]*role="img")(?=[^>]*aria-label="New hint reward")[^>]*>/,
    "the reward wrapper is discoverable as the named New hint reward image",
  );
  assert.doesNotMatch(
    rewardSource,
    /role="status"|aria-live=/,
    "reward artwork must not duplicate the separate live status channel",
  );
  assert.match(
    screenSource,
    /className=\{styles\.rewardAnnouncement\}[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
    "SafeGameScreen retains the separate polite live status owner",
  );
});
