# Safe Cat

A browser game built with Next.js, React and TypeScript. Guess a whole safe code from 1 to 1000. Wrong guesses receive neutral feedback. Solve an addition, subtraction, multiplication or division challenge to earn the code's parity hint. Giving up a challenge reveals only its arithmetic answer. History records guesses and earned hints; surrender reveals the safe code and New Game starts a fresh round. Session state stays in memory and is lost on reload.

## Development

Use the monorepo's installed dependencies, a supported Node.js runtime and Corepack pnpm 9.15.9. Run commands from `apps/safe_app`:

```sh
corepack pnpm dev
corepack pnpm build
corepack pnpm start
```

The `/` route includes the illustrated background; `/safe` renders the same game without that wrapper. `/example` and `/example2` retain standalone exercise examples. The layout loads Geist font variables; existing game styles keep their current system-font fallback. A production build may fetch the configured Google fonts.

## Structure

`src/features/safe-game/domain` owns pure game rules with injected randomness. `model` owns the React session controller, challenge identities and display selectors. `presentation` owns the scene and accessible controls. Routes import the feature entry point. Unreachable historical prototypes live in `src/legacy/safe-cat`; live feature code must not import them.

## Verification

```sh
corepack pnpm test:unit
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.tests.json --noEmit
node scripts/check-boundaries.mjs
node scripts/check-boundaries.mjs --self-test
node node_modules/next/dist/bin/next lint --no-cache
corepack pnpm build
```

The unit runner selects compiled acceptance tests and cleans its own unique operating-system temporary directory. `node scripts/test-unit.mjs failure-probe` intentionally fails an assertion; `node scripts/test-unit.mjs empty-selection-probe` intentionally selects no tests. Both must exit nonzero.

Browser checks require an already installed Playwright module and Google Chrome, plus a running build. Set `SAFE_CAT_BASE_URL` to its URL, `PLAYWRIGHT_MODULE` to the supplied Playwright module path. The scripts launch the installed `chrome` browser channel. Then run:

```sh
node tests/runtime-regression.cjs
node tests/safe-game-interactions.cjs
```

These checks create fresh browser contexts and do not require saved accounts or game data. Static boundary checks complement runtime tests; they do not establish visual or interaction correctness.
