# TimeTag file structure report

_Last verified: 2026-04-20_

## Scope
- This report covers the current structure of `apps/timetag/src`.
- It reflects the verified file tree in the workspace at the time of this update.
- The goal is to document what exists now, correct stale paths, and highlight the few areas that changed since the previous report.

## Executive summary

The `apps/timetag/src` tree still follows the intended layered structure:

- `app/` — Next.js App Router entry and internal preview routes
- `domain/` — pure business logic, settings normalization, theme pipeline, timer logic
- `entities/` — entity-level UI composition for tasks
- `features/` — focused user-facing interactions and editors
- `shared/` — reusable hooks, icons, UI primitives, utils
- `store/` — context providers and persistence wiring
- `widgets/` — screen-level assembled UI blocks

The overall architecture is still in good shape. No destructive reorganization is needed.

## What changed since the previous report

The previous report had several stale details. These are now corrected here:

- `task.meta.ts` exists in `src/domain` and is part of the current domain layer.
- Theme logic is now split across dedicated modules in `src/domain`:
  - `theme.colors.ts`
  - `theme.css-vars.ts`
  - `theme.init-script.ts`
  - `theme.palette.ts`
  - `theme.presets.ts`
  - `theme.tokens.ts`
  - `theme.types.ts`
  - `theme.ts`
- Task-row subcomponents are grouped under `src/entities/task/components/*`.
- The canonical paths for task-row building blocks are now:
  - `src/entities/task/components/SelectionCheckbox.tsx`
  - `src/entities/task/components/TaskStatusToggle.tsx`
  - `src/entities/task/components/TaskMetaCluster.tsx`
  - `src/entities/task/components/TaskTimerCluster.tsx`
  - `src/entities/task/components/TaskRowActionsMenu.tsx`
- `TaskMetaCluster` currently handles:
  - the fixed urgent-priority slot
  - the production soft-inset priority marker
  - the preview-only legacy bar variant
  - the note-indicator slot used when note previews are hidden
- Internal preview routes now include:
  - `src/app/preview/select-checkbox/*`
  - `src/app/preview/task-row-priority/*`
  - `src/app/preview/task-row-priority-neutral-bar/page.tsx` (redirect alias to the consolidated preview)
- `src/widgets/settings-panel/index.ts` currently exports only `SettingsPanel`.
- `src/features/index.ts` re-exports feature components, but not widget-level settings-panel files.

## Current top-level `src` structure

```text
src/
  app/
  domain/
  entities/
  features/
  shared/
  store/
  widgets/
```

## Current structure status by layer

### `app`
Current files/folders:
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/ThemeController.tsx`
- `src/app/preview/select-checkbox/*`
- `src/app/preview/task-row-priority/*`
- `src/app/preview/task-row-priority-neutral-bar/page.tsx`

Assessment:
- Matches the expected Next.js App Router entry layer.
- Preview routes are additive internal tooling and should remain outside the main feature/widget hierarchy.
- `task-row-priority-neutral-bar` is now an alias route that redirects to the consolidated priority preview host.

### `domain`
Current files:
- `src/domain/duration.ts`
- `src/domain/helpers.ts`
- `src/domain/index.ts`
- `src/domain/settings.guards.ts`
- `src/domain/settings.normalize.ts`
- `src/domain/settings.types.ts`
- `src/domain/task.filter.ts`
- `src/domain/task.meta.ts`
- `src/domain/task.operations.ts`
- `src/domain/task.pipeline.ts`
- `src/domain/task.status.ts`
- `src/domain/task.types.ts`
- `src/domain/task.urgency.ts`
- `src/domain/theme.colors.ts`
- `src/domain/theme.css-vars.ts`
- `src/domain/theme.init-script.ts`
- `src/domain/theme.palette.ts`
- `src/domain/theme.presets.ts`
- `src/domain/theme.tokens.ts`
- `src/domain/theme.ts`
- `src/domain/theme.types.ts`
- `src/domain/timer.logic.ts`
- `src/domain/timer.presets.ts`
- `src/domain/timer.ring.ts`
- `src/domain/workspace.ts`

Assessment:
- Strong and still appropriately pure.
- The settings normalization split remains correct.
- The theme system is now clearly modularized and should be treated as a sub-area of the domain layer rather than a single-file concern.
- `task.meta.ts` is an important current module for derived presentation metadata and should stay documented.

### `entities`
Current files/folders:
- `src/entities/index.ts`
- `src/entities/task/index.ts`
- `src/entities/task/TaskRow.tsx`
- `src/entities/task/task-row.viewmodel.ts`
- `src/entities/task/task-timer-cluster.styles.ts`
- `src/entities/task/components/index.ts`
- `src/entities/task/components/SelectionCheckbox.tsx`
- `src/entities/task/components/TaskMetaCluster.tsx`
- `src/entities/task/components/TaskRowActionsMenu.tsx`
- `src/entities/task/components/TaskStatusToggle.tsx`
- `src/entities/task/components/TaskTimerCluster.tsx`

Assessment:
- This layer improved further.
- `TaskRow.tsx` remains the main entity composer.
- View-model derivation stays in `task-row.viewmodel.ts`.
- Timer-cluster styles are split into a pure mapping file.
- The metadata/timer/action subcomponents are correctly grouped under `components/`.

### `features`
Current folders:
- `src/features/bulk-actions/*`
- `src/features/list-filter/*`
- `src/features/list-search/*`
- `src/features/list-sort/*`
- `src/features/settings/*`
- `src/features/status-filters/*`
- `src/features/task-composer/*`
- `src/features/workspace-switch/*`
- `src/features/index.ts`

Important current files:
- `src/features/task-composer/AddTaskInput.tsx`
- `src/features/task-composer/task-composer.mappers.ts`
- `src/features/task-composer/useTaskComposerState.ts`
- `src/features/task-composer/components/*`
- `src/features/settings/AppearanceSettingsSection.tsx`
- `src/features/settings/GeneralSettingsSection.tsx`
- `src/features/settings/SettingsSidebar.tsx`
- `src/features/settings/SettingsTabs.tsx`
- `src/features/settings/TimerSettingsSection.tsx`

Assessment:
- Still aligned with the intended feature layer.
- The task-composer split remains valid and useful.
- Settings remains a feature layer, while the overlay shell stays in `widgets/settings-panel`.

### `shared`
Current folders:
- `src/shared/hooks/*`
- `src/shared/icons/*`
- `src/shared/ui/*`
- `src/shared/utils/*`
- `src/shared/index.ts`

Verified current files:
- hooks:
  - `src/shared/hooks/index.ts`
  - `src/shared/hooks/useKeyboardShortcuts.ts`
  - `src/shared/hooks/useLocalStorage.ts`
  - `src/shared/hooks/usePersistedWorkspaces.ts`
- ui:
  - `src/shared/ui/Badge.tsx`
  - `src/shared/ui/Checkbox.tsx`
  - `src/shared/ui/Chip.tsx`
  - `src/shared/ui/Dropdown.tsx`
  - `src/shared/ui/TimerRingButton.tsx`
  - `src/shared/ui/Toast.tsx`
  - `src/shared/ui/index.ts`
- utils:
  - `src/shared/utils/formatTime.ts`
  - `src/shared/utils/index.ts`

Assessment:
- Still clean and reusable.
- `src/shared/index.ts` currently re-exports hooks, icons, UI, and utils.
- `useFocusRef` is currently re-exported from `src/shared/hooks/index.ts` via `useKeyboardShortcuts.ts`.

### `store`
Current files:
- `src/store/index.ts`
- `src/store/settings.store.tsx`
- `src/store/task.store.tsx`

Assessment:
- Current split remains appropriate.
- `settings.store.tsx` is slimmer than before thanks to the extracted domain normalization helpers.
- `task.store.tsx` remains the central source of truth for task state and visible-list derivation.

### `widgets`
Current folders/files:
- `src/widgets/header/*`
- `src/widgets/settings-panel/*`
- `src/widgets/task-list/*`
- `src/widgets/index.ts`

Verified settings-panel files:
- `src/widgets/settings-panel/SettingsPanel.tsx`
- `src/widgets/settings-panel/SettingsPanelFooter.tsx`
- `src/widgets/settings-panel/SettingsPanelSection.tsx`
- `src/widgets/settings-panel/settings-panel.config.ts`
- `src/widgets/settings-panel/useSettingsDraft.ts`
- `src/widgets/settings-panel/index.ts`

Assessment:
- The widget layer remains well separated from feature logic.
- `widgets/index.ts` currently exports:
  - `Header`
  - `SettingsPanel`
  - `TaskList`
  - `TaskListWidget`
- `widgets/settings-panel/index.ts` currently exports only `SettingsPanel`.

## Current barrel status

### Verified current barrels
- `src/domain/index.ts`
  - re-exports `duration`, `task.meta`, `settings.*`, `task.*`, `theme`, `timer.*`, `helpers`, `workspace`
- `src/shared/index.ts`
  - re-exports shared UI, icons, hooks, and utils
- `src/features/index.ts`
  - re-exports feature-level controls and settings feature sections
- `src/widgets/index.ts`
  - re-exports `Header`, `SettingsPanel`, `TaskListWidget`, and `TaskList`
- `src/entities/task/components/index.ts`
  - re-exports the canonical task-row subcomponents

Assessment:
- Barrel consistency is good.
- The main stale point in the previous report was not the presence of barrels, but outdated descriptions of what they actually expose.

## Responsibility notes for the most important current files

### `src/domain/task.meta.ts`
- Holds derived metadata state for task rows.
- Keeps note-related and urgent-priority derivation outside `TaskRow.tsx`.

### `src/domain/theme.tokens.ts`
- Builds token groups for surfaces, text, accents, chips, priority markers, rings, selection, and shadows.
- Feeds `resolveThemeTokens()` for runtime and pre-hydration theme application.

### `src/domain/theme.init-script.ts`
- Serializes the theme bootstrap helpers used before hydration.
- Must stay in sync with `resolveThemeTokens()` whenever token-builder dependencies change.

### `src/entities/task/TaskRow.tsx`
- Main row layout composer.
- Wires settings-driven note/urgency behavior into `TaskMetaCluster`.
- Keeps title/note rendering separate from timer/menu controls.

### `src/entities/task/components/TaskMetaCluster.tsx`
- Renders the reserved metadata area before the content block.
- Owns:
  - priority-slot reservation
  - soft-inset urgent marker in production
  - legacy bar preview variant
  - note slot / note indicator when note previews are hidden
- Returns `null` when neither priority nor note slots are needed.

### `src/entities/task/task-row.viewmodel.ts`
- Builds derived row presentation data from a `Task` plus row settings.
- Keeps `TaskRow.tsx` lighter and presentation-oriented.

### `src/app/preview/task-row-priority/TaskRowPriorityPreview.tsx`
- Consolidated internal host for side-by-side urgent-priority visual comparisons.
- Used for previewing historical and alternative marker treatments without creating new production variants.

### `src/app/preview/task-row-priority-neutral-bar/page.tsx`
- Redirect-only compatibility route.
- Exists so old preview links still land on the consolidated priority preview page.

## Existing additive files that are justified and should stay

These files are not structure drift; they are useful extractions:

- `src/domain/task.filter.ts`
- `src/domain/task.meta.ts`
- `src/domain/task.operations.ts`
- `src/domain/workspace.ts`
- `src/domain/theme.colors.ts`
- `src/domain/theme.css-vars.ts`
- `src/domain/theme.init-script.ts`
- `src/domain/theme.palette.ts`
- `src/domain/theme.presets.ts`
- `src/domain/theme.tokens.ts`
- `src/domain/theme.types.ts`
- `src/entities/task/task-row.viewmodel.ts`
- `src/entities/task/task-timer-cluster.styles.ts`
- `src/entities/task/components/TaskMetaCluster.tsx`
- `src/entities/task/components/TaskTimerCluster.tsx`
- `src/entities/task/components/TaskRowActionsMenu.tsx`
- `src/features/task-composer/task-composer.mappers.ts`
- `src/features/task-composer/useTaskComposerState.ts`
- `src/app/preview/select-checkbox/*`
- `src/app/preview/task-row-priority/*`

## Recommended next splits

### 1. `src/entities/task/TaskRow.tsx`
Status: acceptable, but watch growth.

Potential future split if needed:
- extract the title + note content block into a dedicated presentational subcomponent
- move row spacing/constants into a small config module if more layout tuning continues

Priority: low to medium

### 2. `src/store/task.store.tsx`
Status: still the biggest remaining architectural pressure point.

Potential future split if it grows further:
- persistence helpers
- selection helpers
- reducer action builders or grouped reducer utilities

Priority: medium

### 3. `src/features/task-composer/AddTaskInput.tsx`
Status: improved and currently reasonable.

Potential future split if the header row grows again:
- extract preset selectors / header controls into a dedicated component

Priority: low

## Final verdict

The requested layered structure is still implemented in practice.

The right strategy remains:
1. keep the current layered tree,
2. preserve useful additive modules,
3. keep barrels honest and current,
4. continue only small, targeted extractions where file pressure appears,
5. update docs when paths or responsibilities move.
