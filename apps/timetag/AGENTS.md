# AGENTS.md

## Scope
- These instructions apply only to `apps/timetag`.
- Prefer changes inside this app unless the task explicitly asks for cross-app edits.

## Commands (default: run from `apps/timetag`)
- Runtime requirement: Node.js `>=20.9.0`
- Install deps (run from repo root): `pnpm install`
- Dev: `pnpm dev` (default `3003`)
- Alternate dev port: `pnpm exec next dev --turbopack --port <free-port>`
- Build: `pnpm build`
- Lint: `pnpm lint`

## Architecture Map
- `src/app` - Next.js App Router entry.
- `src/features` + `src/widgets` - screen-level composition and feature UI.
- `src/store/task.store.tsx` - source of truth for task state/actions.
- `src/domain` - pure business logic (`task.pipeline.ts`, `task.urgency.ts`, `timer.logic.ts`).
- `src/shared` - reusable UI/hooks/icons/utils.

## State + Persistence Rules
- UI dispatches through `useTasks()` from `src/store/task.store.tsx`.
- Visible tasks must be derived through `applyPipeline()` (`src/domain/task.pipeline.ts`).
- `useLocalStorage` (`src/shared/hooks/useLocalStorage.ts`) is SSR-safe:
  - first render uses `initialValue`;
  - localStorage read happens in `useEffect` after mount;
  - setter updates React state and localStorage together.
- Keep hydration guards in `TaskProvider` intact to avoid update loops.

## Domain Decisions
- Workspace filter supports `all` and custom workspace ids.
- `WorkspaceType` intentionally allows built-in ids and user-created string ids.
- Urgency is ratio-based (`remainingSec / originalDurationSec`) in `src/domain/task.urgency.ts`.
- `isApproachingRed()` uses user window minutes relative to the danger threshold boundary.
- **Task Priority**: 2-level system ('normal' | 'urgent')
  - Default: 'normal' when creating tasks
  - FilterState includes `priority: {normal: boolean, urgent: boolean}`
  - SortField includes 'priority' (urgent tasks first when sorting asc)
  - Applied in pipeline after urgency filter (step 4), before mode filter
  - UI: black circle with white '!' indicator in TaskRow title area for urgent tasks
  - Component: `src/features/task-composer/components/PrioritySelect.tsx` (segmented control)

## Workspace Switch Conventions
- File: `src/features/workspace-switch/WorkspaceSwitch.tsx`.
- Keep default workspaces `work` and `home`.
- Keep `all` tab always present and functional.
- Workspace id strategy: slug from label; fallback `ws-${generateId()}` (`src/domain/helpers.ts`).

## Known Caveat
- `src/shared/ui/Dropdown.tsx` currently has `react-hooks/exhaustive-deps` warnings around `handleClose` effects.
- Fix locally when touching this file; do not silence globally.

