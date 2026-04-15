# TimeTag Architecture Audit

Date: 2026-04-16

## Scope

Reviewed `apps/timetag/src` with focus on the layered architecture documented in `AGENTS.md`:

- `app/`
- `widgets/`
- `features/`
- `entities/`
- `domain/`
- `shared/`
- `store/`

Primary audit goals:

1. keep `applyPipeline()` as the single task-query path;
2. remove business logic from UI components when that logic belongs in `domain` or `store`;
3. keep timer/state orchestration in `store` + `domain`, not row rendering;
4. document both healthy patterns and remaining follow-up work.

## High-level Findings

### Patterns that already matched the intended architecture

- `src/domain/task.pipeline.ts`
  - remains the canonical list-processing pipeline;
  - preserves query order: workspace → status → filter groups → search → sort.
- `src/domain/timer.logic.ts`
  - timer state transitions are already isolated as pure domain functions.
- `src/widgets/header/Header.tsx`
  - stays isolated from task query logic and task collections.
- `src/features/list-search/SearchInput.tsx`
  - acts as a query-state control only.
- `src/features/status-filters/StatusFilters.tsx`
  - updates status query state only.
- `src/features/workspace-switch/WorkspaceSwitch.tsx`
  - remains focused on workspace context and workspace persistence.

### Violations or mixed responsibilities found during the audit

1. `src/store/task.store.tsx`
   - contained domain-level task creation and hydration normalization logic directly inside the store file;
   - mixed state orchestration with entity construction and data sanitization.
2. `src/widgets/task-list/TaskList.tsx`
   - performed task status transition rules locally (`active -> done`, `done -> active`, archive/restore behavior);
   - UI was deciding business transitions instead of dispatching store/domain actions.
3. `src/entities/task/TaskRow.tsx`
   - computed urgency classification and timer display derivations inline;
   - row rendering carried reusable derived-state logic that should be extracted.
4. `src/features/list-filter/FilterDropdown.tsx`
   - duplicated default filter values and nested filter mutation logic already conceptually owned by the query/domain layer.

## Refactoring Decisions Implemented

### 1. Moved task creation and hydration normalization into `domain`

**New file:** `src/domain/task.operations.ts`

Moved out of the store:

- task creation from `CreateTaskInput`;
- hydration normalization for persisted tasks;
- helper that pauses other running timers.

**Why:**

- task construction/sanitization is pure business logic;
- the store should orchestrate actions, not define entity factories inline;
- extracted helpers are now reusable and easier to test independently.

### 2. Centralized filter defaults and filter patch helpers in `domain`

**New file:** `src/domain/task.filter.ts`

Added:

- `createDefaultTaskFilter()`;
- `createResettableTaskFilterPatch()`;
- reusable patch helpers for urgency, priority, mode, reminders, and approaching-red state.

**Why:**

- removes duplicated filter defaults from UI;
- keeps filter-shape knowledge in one place;
- allows controls to remain “dispatch/query update only”.

### 3. Moved status transition ownership from widget code into the store/domain boundary

**Changed files:**

- `src/domain/task.status.ts`
- `src/store/task.store.tsx`
- `src/widgets/task-list/TaskList.tsx`

Changes:

- `task.status.ts` now accepts `nowIso` so transitions stay deterministic;
- `task.store.tsx` now exposes status-oriented actions (`toggleTaskStatus`, `archiveTask`, `restoreTask`) and uses domain transition helpers;
- `TaskList.tsx` now consumes `visibleTasks` and dispatches actions instead of computing transitions locally.

**Why:**

- keeps UI renderers free of business transition rules;
- reinforces store ownership of orchestration;
- aligns with the requirement that task rows/list controls should reflect state, not decide lifecycle behavior.

### 4. Extracted row-level derived state into a dedicated pure helper

**New file:** `src/entities/task/task-row.viewmodel.ts`

**Changed file:** `src/entities/task/TaskRow.tsx`

Moved out of the component body:

- urgency lookup;
- note preview derivation;
- timer display label generation;
- timer tooltip text generation;
- derived booleans for timer disabled/running/paused and meta cluster visibility.

**Why:**

- keeps `TaskRow` focused on pure entity rendering;
- makes derived state reusable/testable without JSX;
- removes domain-ish calculations from component markup.

### 5. Clarified “prepared list” ownership

**Changed files:**

- `src/domain/task.pipeline.ts`
- `src/store/task.store.tsx`
- `src/widgets/task-list/TaskList.tsx`

Changes:

- added `createPipelineQuery()` near `applyPipeline()`;
- store now exposes `visibleTasks` instead of `filteredTasks`;
- task list consumes prepared `visibleTasks` directly.

**Why:**

- better matches the actual architecture language;
- makes it explicit that the list receives already-processed results;
- reduces the chance of future local filtering/sorting in widgets.

## Files Changed

### New files

- `src/domain/task.filter.ts`
- `src/domain/task.operations.ts`
- `src/entities/task/task-row.viewmodel.ts`
- `e2e/task-query-pipeline.spec.ts`
- `docs/ARCHITECTURE_AUDIT.md`

### Updated files

- `e2e/task-row.spec.ts`
- `src/domain/index.ts`
- `src/domain/task.pipeline.ts`
- `src/domain/task.status.ts`
- `src/store/task.store.tsx`
- `src/features/list-filter/FilterDropdown.tsx`
- `src/widgets/task-list/TaskList.tsx`
- `src/widgets/task-list/TaskListWidget.tsx`
- `src/entities/task/TaskRow.tsx`

## What was intentionally left unchanged

### `src/features/task-composer/AddTaskInput.tsx`

The composer still contains a large amount of pure preset/default-selection logic. Some of that logic is a good future extraction candidate, but a full split was intentionally left out of this pass because:

- the file already depends on multiple preset/domain modules;
- a deeper extraction would benefit from dedicated unit coverage for composer state transitions;
- the current audit prioritized removing business logic from the list/query/status path first, where layering violations were more immediate.

### `src/widgets/task-list/TaskListWidget.tsx`

The widget still performs screen-level orchestration around settings hydration and startup view application. That remains acceptable for now because it coordinates UI composition rather than recomputing task datasets.

## Remaining Risks / Follow-up Recommendations

1. **Extract composer state helpers**
   - Candidate target: `src/domain/task-composer.ts` or similar.
   - Good next step for deadline/duration/pomodoro default resolution and submit payload creation.

2. **Add focused unit tests for pure helpers**
   - `task.filter.ts`
   - `task.operations.ts`
   - `task.status.ts`
   - `task-row.viewmodel.ts`

3. **Consider store selectors for additional derived UI state**
   - if more widgets need prepared counts or grouped task summaries, add selectors rather than recomputing in components.

4. **Review generic `updateTask()` usage over time**
   - for lifecycle/status/timer transitions, prefer explicit store/domain actions over ad-hoc partial updates.

## Validation Checklist

The refactor was validated against the architecture requirements by checking that:

- visible task rendering still consumes a centralized prepared list;
- workspace switching changes workspace context without replacing status logic;
- status filtering still affects status only;
- search, filter, and sort continue to flow through the centralized query pipeline;
- task rows render from prepared derived state without owning timer/status rules;
- timer controls still reflect timer state after store-owned status transitions.

Validation runs completed for this audit pass:

- `pnpm lint`
- `pnpm build`
- `pnpm exec playwright test e2e/task-query-pipeline.spec.ts e2e/task-row.spec.ts`

## Summary

This audit keeps TimeTag aligned with the existing layered design without redesigning the app structure:

- `domain` owns pure task/filter/status logic;
- `store` owns orchestration and exposed actions;
- `features/widgets/entities` render state and dispatch events;
- the list pipeline remains centralized and explicit.


