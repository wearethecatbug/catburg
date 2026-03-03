# AGENTS.md

## Scope
- This file documents working conventions for `apps/timetag` in this monorepo.
- Prefer app-local paths and commands unless explicitly asked to change other apps.
- For TimeTag tasks, treat `apps/timetag/AGENTS.md` as the most specific source of truth.

## Monorepo + Tooling
- Package manager: `pnpm`.
- TimeTag app package: `apps/timetag` (`name: timetag`).
- Verified build command (from app dir): `pnpm build`.
- Dev command (from app dir): `pnpm dev` (default port `3003`; if busy, run `pnpm exec next dev --turbopack --port <free-port>`).

## Architecture (TimeTag)
- UI/feature composition follows layered structure in `apps/timetag/src`:
  - `app/` (Next.js App Router entry)
  - `widgets/` + `features/` (screen composition and feature UI)
  - `store/` (global task state via React context + reducer)
  - `domain/` (pure business logic, filters/sort/timer/urgency/types)
  - `shared/` (reusable hooks/UI/icons/utils)
- Primary flow:
  1. UI dispatches actions via `useTasks()` from `store/task.store.tsx`.
  2. Reducer updates `TaskState`.
  3. Visible list is derived by `applyPipeline()` in `domain/task.pipeline.ts`.

## State + Persistence Conventions
- `TaskProvider` in `store/task.store.tsx` is the source of truth for tasks, filters, sort, selection.
- Persistence uses `shared/hooks/uselocalstorage.ts` with SSR-safe pattern:
  - initial render uses `initialValue`;
  - storage is read in `useEffect` after mount;
  - setter writes state and `localStorage` atomically.
- When adding persisted keys, keep the same SSR-safe hydration pattern to avoid Next.js mismatch loops.

## Domain Rules to Preserve
- Workspace filtering supports `all` plus user-created workspace ids.
- `domain/task.urgency.ts` currently computes urgency by remaining percentage (`remainingSec / originalDurationSec`), not fixed minutes.
- `isApproachingRed()` is tied to the danger threshold boundary and user window minutes.

## Workspace Switch Notes
- Feature file: `features/workspace-switch/WorkspaceSwitch.tsx`.
- Workspace id strategy:
  - slug from label when possible;
  - fallback `ws-${generateId()}` from `domain/helpers.ts`.
- Keep both default workspaces (`work`, `home`) and user-created tabs; `all` is functional and always present.

## Known Lint Caveat
- `shared/ui/Dropdown.tsx` currently has `react-hooks/exhaustive-deps` warnings around `handleClose` effects.
- Do not silence globally; fix locally when touching that file.

## Editing Guidelines for This App
- Keep business logic in `domain/*` pure and deterministic.
- Keep reducer actions explicit; avoid hidden side effects in reducer branches.
- If adding new filter/sort fields, update both `task.types.ts` and `task.pipeline.ts` together.
- For branch merges/conflicts in TimeTag, prefer additive merges (keep both implementations) unless behavior is impossible to combine, then ask the user.
