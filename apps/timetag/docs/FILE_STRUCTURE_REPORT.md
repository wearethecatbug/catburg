# TimeTag file structure report

## What was updated

The source tree in `apps/timetag/src` already matched the requested layered structure almost completely.

To make the structure fully consistent and easier to consume, I aligned the barrel exports and added the missing utility barrel:

- added `src/shared/utils/index.ts`
- updated `src/shared/index.ts` to re-export `shared/utils`
- updated `src/domain/index.ts` to re-export `duration` and `theme`
- updated `src/features/index.ts` to re-export `features/settings`
- updated `src/widgets/index.ts` to re-export `widgets/settings-panel`

## Implemented follow-up splits

Based on the recommendations below, the following extractions were implemented:

- added `src/domain/settings.guards.ts`
- added `src/domain/settings.normalize.ts`
- moved settings normalization logic out of `src/store/settings.store.tsx`
- added `src/features/task-composer/task-composer.mappers.ts`
- added `src/features/task-composer/useTaskComposerState.ts`
- moved composer state/orchestration out of `src/features/task-composer/AddTaskInput.tsx`
- added `src/widgets/settings-panel/useSettingsDraft.ts`
- added `src/widgets/settings-panel/SettingsPanelFooter.tsx`
- added `src/widgets/settings-panel/settings-panel.config.ts`
- added `src/widgets/settings-panel/SettingsPanelSection.tsx`
- moved settings draft-state/footer logic out of `src/widgets/settings-panel/SettingsPanel.tsx`
- moved settings section metadata/render branching out of `src/widgets/settings-panel/SettingsPanel.tsx`
- grouped task-row subcomponents under `src/entities/task/components/*`
- extracted timer-cluster styles and actions menu out of `src/entities/task/TaskRow.tsx`

## Requested structure status

### Matches the requested structure
- `app/*`
- `domain/*` including `settings.types.ts`, `theme.ts`, `timer.presets.ts`
- `features/settings/*`
- `shared/hooks/usePersistedWorkspaces.ts`
- `store/settings.store.tsx`
- `widgets/settings-panel/*`

### Existing additive files not shown in the example
These are already useful and should stay:

- `src/domain/task.filter.ts` — filter state helpers and patch builders
- `src/domain/task.operations.ts` — task creation, hydration normalization, running-task pause helper
- `src/domain/workspace.ts` — workspace ids, defaults, normalization
- `src/entities/task/SelectionCheckbox.tsx` — row selection control
- `src/entities/task/TaskStatusToggle.tsx` — done/active toggle
- `src/entities/task/TaskMetaCluster.tsx` — row-level metadata cluster for note/urgent indicators
- `src/entities/task/task-row.viewmodel.ts` — derived row presentation model
- `src/features/task-composer/components/PrioritySelect.tsx` — urgent/normal selector
- `src/app/preview/select-checkbox/*` — internal UI preview route

These files are additive refactors, not structure drift.

---

## Responsibility by file

### `app`
- `src/app/globals.css` — global CSS variables, resets, and app-wide visual tokens.
- `src/app/layout.tsx` — root App Router layout; wires providers, initial theme script, metadata, and hydration-safe setup.
- `src/app/page.tsx` — main route entry that renders the assembled task list screen.
- `src/app/ThemeController.tsx` — client-side theme sync between persisted settings and DOM CSS variables.

### `domain`
- `src/domain/duration.ts` — duration units, preset catalogs, clamping, formatting, and conversion helpers for duration mode.
- `src/domain/helpers.ts` — generic pure helpers such as id generation and compact time badge formatting.
- `src/domain/index.ts` — domain barrel export for pure business logic and types.
- `src/domain/settings.guards.ts` — shared runtime guards and clamping helpers for settings parsing.
- `src/domain/settings.normalize.ts` — pure normalization/migration pipeline for persisted settings payloads.
- `src/domain/settings.types.ts` — central app settings schema, defaults, storage key, tabs/sections ids, and settings-related types.
- `src/domain/task.pipeline.ts` — applies workspace/filter/search/sort pipeline to derive the visible task list.
- `src/domain/task.status.ts` — deterministic task status transitions such as active/done/archived.
- `src/domain/task.types.ts` — canonical task, filter, sort, timer, reminder, and workspace type definitions.
- `src/domain/task.urgency.ts` — urgency calculation and urgency-filter option definitions based on remaining/original ratio.
- `src/domain/theme.ts` — theme modes, custom theme presets, token resolution, and DOM theme application helpers.
- `src/domain/timer.logic.ts` — timer state machine operations like toggle, reset, and tick.
- `src/domain/timer.presets.ts` — pomodoro/deadline preset catalogs, validation, and formatting helpers.
- `src/domain/timer.ring.ts` — visual-state derivation for timer ring UI from ratios, urgency, and timer status.

### `entities`
- `src/entities/task/index.ts` — task entity barrel for `TaskRow` and canonical task-row subcomponents.
- `src/entities/task/components/index.ts` — barrel for internal task-row building blocks.
- `src/entities/task/components/TaskRowActionsMenu.tsx` — task-row dropdown menu with reset/status/archive/delete actions.
- `src/entities/task/components/TaskTimerCluster.tsx` — task-row timer pill with ring button, display value, and tooltip title.
- `src/entities/task/components/SelectionCheckbox.tsx` — task-row selection checkbox with the shipped visual variant.
- `src/entities/task/components/TaskStatusToggle.tsx` — task-row done/active status toggle.
- `src/entities/task/components/TaskMetaCluster.tsx` — compact metadata renderer for urgent and note indicators inside the row.
- `src/entities/task/task-timer-cluster.styles.ts` — pure timer-cluster style mapping for idle/running/paused/warn/zero/overdue states.
- `src/entities/task/TaskRow.tsx` — the main task-row entity; composes task controls, timer ring, menu, and metadata for one task.
- `src/entities/index.ts` — top-level entity barrel.

### `features`
- `src/features/bulk-actions/BulkDropdown.tsx` — bulk actions menu for selected tasks.
- `src/features/bulk-actions/index.ts` — barrel for bulk-actions feature.
- `src/features/list-filter/FilterDropdown.tsx` — advanced list filters (urgency, approaching-red, reminders, mode, priority).
- `src/features/list-filter/index.ts` — barrel for list-filter feature.
- `src/features/list-search/index.ts` — barrel for search feature.
- `src/features/list-search/SearchInput.tsx` — controlled search box bound to task query state.
- `src/features/list-sort/index.ts` — barrel for sort feature.
- `src/features/list-sort/SortDropdown.tsx` — sort field/direction selector.
- `src/features/settings/AppearanceSettingsSection.tsx` — appearance settings editor (theme, layout, ring, custom colors).
- `src/features/settings/GeneralSettingsSection.tsx` — general behavior/defaults/interface settings editor.
- `src/features/settings/index.ts` — settings feature barrel.
- `src/features/settings/SettingsSidebar.tsx` — left navigation between General / Timer / Appearance settings sections.
- `src/features/settings/SettingsTabs.tsx` — reusable tab strip for subsections inside settings.
- `src/features/settings/TimerSettingsSection.tsx` — timer-mode defaults, runtime behavior, and preset visibility editor.
- `src/features/status-filters/index.ts` — barrel for status-filter feature.
- `src/features/status-filters/StatusFilters.tsx` — active/all/done/archived filter tabs.
- `src/features/task-composer/AddTaskInput.tsx` — thin task creation view that renders the composer UI and delegates state/orchestration to feature-local helpers.
- `src/features/task-composer/index.ts` — task-composer barrel.
- `src/features/task-composer/task-composer.mappers.ts` — pure helpers for duration/deadline labels and mapping composer draft state into `CreateTaskInput`.
- `src/features/task-composer/useTaskComposerState.ts` — local hook that owns task-composer draft state, preset synchronization, and submit/reset handlers.
- `src/features/task-composer/components/DetailsPanel.tsx` — expanded composer form for note, priority, timer mode, and advanced task details.
- `src/features/task-composer/components/Dropdown.tsx` — local dropdown primitive used inside the composer.
- `src/features/task-composer/components/DurationField.tsx` — duration input with unit switching and clamping.
- `src/features/task-composer/components/index.ts` — composer-components barrel.
- `src/features/task-composer/components/ModeSelector.tsx` — segmented selector for duration / pomodoro / deadline modes.
- `src/features/task-composer/components/NumberInput.tsx` — numeric field primitive for pomodoro settings.
- `src/features/task-composer/components/PomodoroSettings.tsx` — grouped pomodoro parameter inputs.
- `src/features/task-composer/components/README.md` — local composer component notes.
- `src/features/task-composer/components/TimerControlsSection.tsx` — auto-start / auto-play / auto-reset / overdue toggle group.
- `src/features/task-composer/components/TimerControlToggle.tsx` — reusable switch row for timer controls.
- `src/features/workspace-switch/index.ts` — workspace-switch barrel.
- `src/features/workspace-switch/WorkspaceSwitch.tsx` — workspace tab bar with built-in + user-created workspaces and persistence.
- `src/features/index.ts` — top-level features barrel.

### `shared`
- `src/shared/hooks/index.ts` — hooks barrel.
- `src/shared/hooks/useKeyboardShortcuts.ts` — global keyboard shortcut registration for add/search/escape actions.
- `src/shared/hooks/useLocalStorage.ts` — SSR-safe localStorage hook with delayed hydration.
- `src/shared/hooks/usePersistedWorkspaces.ts` — persisted workspace list hook built on top of `useLocalStorage`.
- `src/shared/icons/IconBase.tsx` — common SVG icon wrapper and size mapping.
- `src/shared/icons/icons.tsx` — concrete icon components.
- `src/shared/icons/index.ts` — icon barrel.
- `src/shared/ui/Badge.tsx` — small status/time badge primitive.
- `src/shared/ui/Checkbox.tsx` — shared checkbox primitive.
- `src/shared/ui/Chip.tsx` — removable chip/tag primitive.
- `src/shared/ui/Dropdown.tsx` — shared dropdown/menu primitive.
- `src/shared/ui/index.ts` — shared UI barrel.
- `src/shared/ui/TimerRingButton.tsx` — circular timer progress button component.
- `src/shared/ui/Toast.tsx` — toast hook + toast container/presentation.
- `src/shared/utils/formatTime.ts` — full/short human-readable time formatting helpers.
- `src/shared/utils/index.ts` — utilities barrel.
- `src/shared/index.ts` — top-level shared barrel.

### `store`
- `src/store/index.ts` — store barrel.
- `src/store/settings.store.tsx` — settings context/provider, normalization, persistence, and update APIs.
- `src/store/task.store.tsx` — task source of truth: reducer, visible list derivation, selection, timers, bulk actions, persistence.

### `widgets`
- `src/widgets/header/Header.tsx` — app header with settings trigger and top-level controls.
- `src/widgets/header/index.ts` — header barrel.
- `src/widgets/settings-panel/index.ts` — settings-panel barrel.
- `src/widgets/settings-panel/settings-panel.config.ts` — static section labels and tab definitions for the settings drawer.
- `src/widgets/settings-panel/SettingsPanelSection.tsx` — isolated renderer for the active settings section and its tabbed content.
- `src/widgets/settings-panel/useSettingsDraft.ts` — local hook that manages draft settings state, dirty tracking, save/cancel/reset, and Escape handling.
- `src/widgets/settings-panel/SettingsPanelFooter.tsx` — extracted footer with Reset / Cancel / Save actions for the settings drawer.
- `src/widgets/settings-panel/SettingsPanel.tsx` — settings overlay widget that assembles sidebar, tabs, and extracted draft-state/footer pieces.
- `src/widgets/task-list/index.ts` — task-list barrel.
- `src/widgets/task-list/TaskList.tsx` — paginated visible task list renderer and empty state.
- `src/widgets/task-list/TaskListWidget.tsx` — screen assembler that combines header, filters, composer, list, settings panel, toasts, and shortcuts.
- `src/widgets/index.ts` — top-level widgets barrel.

---

## Recommended next splits

### 1. `src/store/settings.store.tsx`
**Status:** improved.

The provider is now focused on:
- context/provider wiring
- persistence integration
- patch-based update actions

Completed extraction:
- `src/domain/settings.normalize.ts`
- `src/domain/settings.guards.ts`

**Next optional refinement:** extract patch helpers if the provider grows again.

### 2. `src/features/task-composer/AddTaskInput.tsx`
**Status:** improved.

The view is now mostly responsible for rendering and wiring props into presentational controls.

Completed extraction:
- `src/features/task-composer/useTaskComposerState.ts`
- `src/features/task-composer/task-composer.mappers.ts`

**Next optional refinement:** add `components/PresetSelectors.tsx` if the header row grows further.

### 3. `src/widgets/settings-panel/SettingsPanel.tsx`
**Status:** improved.

Completed extraction:
- `src/widgets/settings-panel/useSettingsDraft.ts`
- `src/widgets/settings-panel/SettingsPanelFooter.tsx`

**Completed additional refinement:**
- `src/widgets/settings-panel/settings-panel.config.ts`
- `src/widgets/settings-panel/SettingsPanelSection.tsx`

### 4. `src/entities/task/*`
**Status:** improved.

Completed cleanup:
- removed stale empty files: `MetadataCluster.tsx`, `DoneToggle.tsx`, `NoteIcon.tsx`, `UrgentIcon.tsx`
- kept `TaskMetaCluster.tsx` as the canonical metadata component
- expanded `src/entities/task/index.ts` to expose the real task-row building blocks
- grouped task-row subcomponents into `src/entities/task/components/*`
- extracted timer cluster and actions menu out of `TaskRow.tsx`

**Next optional refinement:**
- extract title/content block if `TaskRow.tsx` still grows, or move row layout constants into a dedicated config module

**Priority:** low to medium

### 5. `src/domain`
**Current assessment:** mostly good.

The extra files not shown in the requested example are justified:
- `task.filter.ts`
- `task.operations.ts`
- `workspace.ts`

I would keep them as separate pure modules instead of merging them back into bigger files.

**Priority:** low, keep as-is

## Overall evaluation

### Structure quality
- **Layering:** good
- **Feature isolation:** good
- **Barrel consistency:** now good after the export updates
- **Purity of domain layer:** good
- **Big-file pressure:** mainly in `AddTaskInput.tsx` and `settings.store.tsx`

### Final verdict
The requested structure is already implemented in practice. The codebase does **not** need a destructive reorganization. The best approach is exactly what was done here:

1. keep the current layered tree,
2. preserve useful additive files,
3. improve barrels/documentation,
4. continue splitting only the few dense files.

