'use client';

import React from 'react';
import {
  getVisibleDeadlinePresetById,
  getVisibleDeadlinePresets,
  getVisiblePomodoroPresetById,
  getVisiblePomodoroPresets,
  formatDeadlineOffsetLabel,
  formatNamedPomodoroPresetLabel,
  formatPomodoroPresetLabel,
  type DeadlinePresetId,
  type PomodoroPresetId,
} from '@/domain/timer.presets';
import {
  getVisibleDurationPresetById,
  getVisibleDurationPresets,
  type DurationPresetId,
  type DurationUnit,
} from '@/domain/duration';
import { useSettings, useTasks } from '@/store';
import { usePersistedWorkspaces } from '@/shared';
import type { AssignableWorkspaceType, TaskPriority, TimerMode } from '@/domain/task.types';
import type { DropdownOption } from './components';
import {
  getWorkspaceLabel,
  hasWorkspace,
  resolveCurrentWorkspaceContext,
} from '@/domain/workspace';
import {
  buildCreateTaskInput,
  buildDeadlineLocalValue,
  CUSTOM_DEADLINE_PRESET_ID,
  CUSTOM_DURATION_PRESET_ID,
  CUSTOM_POMODORO_PRESET_ID,
  formatCompactDurationLabel,
  getApproxDeadlineOffsetSec,
  getDurationPresetLabel,
  getDurationUnitFromSec,
} from './task-composer.mappers';

export const USE_CURRENT_WORKSPACE_OPTION_ID = '__use-current-workspace__';

function getPomodoroPresetTriggerLabel(label: string): string {
  return label.split(' (')[0] || label;
}

interface UseTaskComposerStateOptions {
  defaultWorkspace?: AssignableWorkspaceType;
  forwardedRef?: React.ForwardedRef<HTMLInputElement>;
}

export function useTaskComposerState({ defaultWorkspace, forwardedRef }: UseTaskComposerStateOptions) {
  const { settings, isHydrated: areSettingsHydrated } = useSettings();
  const { addTask, state } = useTasks();
  const { workspaces } = usePersistedWorkspaces();
  const hasWorkspaceTabs = workspaces.length > 0;

  const visibleDurationPresets = getVisibleDurationPresets(settings.timer.hiddenDurationPresetIds);
  const visiblePomodoroPresets = getVisiblePomodoroPresets(settings.timer.hiddenPomodoroPresetIds);
  const visibleDeadlinePresets = getVisibleDeadlinePresets(settings.timer.hiddenDeadlinePresetIds);
  const defaultDurationPreset = getVisibleDurationPresetById(
    settings.timer.durationDefaults.presetId,
    settings.timer.hiddenDurationPresetIds,
  );
  const defaultPomodoroPreset = getVisiblePomodoroPresetById(
    settings.timer.pomodoroDefaults.presetId,
    settings.timer.hiddenPomodoroPresetIds,
  );
  const defaultDeadlinePreset = getVisibleDeadlinePresetById(
    settings.timer.deadlineDefaults.presetId,
    settings.timer.hiddenDeadlinePresetIds,
  );
  const defaultDurationSec = settings.timer.durationDefaults.durationSec;
  const hasCustomDurationDefault = !visibleDurationPresets.some((preset) => preset.durationSec === defaultDurationSec);
  const hasCustomPomodoroDefault = !visiblePomodoroPresets.some((preset) => (
    preset.cycles === settings.timer.pomodoroDefaults.cycles &&
    preset.workDurationMin === settings.timer.pomodoroDefaults.workDurationMin &&
    preset.shortBreakMin === settings.timer.pomodoroDefaults.shortBreakMin &&
    preset.longBreakMin === settings.timer.pomodoroDefaults.longBreakMin
  ));
  const hasCustomDeadlineDefault = !visibleDeadlinePresets.some((preset) => preset.offsetSec === settings.timer.deadlineDefaults.offsetSec);

  const [title, setTitle] = React.useState('');
  const [presetId, setPresetId] = React.useState<DurationPresetId>(() => defaultDurationPreset.id);
  const [pomodoroPresetId, setPomodoroPresetId] = React.useState<PomodoroPresetId>(() => defaultPomodoroPreset.id);
  const [deadlinePresetId, setDeadlinePresetId] = React.useState<DeadlinePresetId>(() => defaultDeadlinePreset.id);
  const [isNoteExpanded, setIsNoteExpanded] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [timerMode, setTimerMode] = React.useState<TimerMode>(settings.timer.defaultMode);
  const [priority, setPriority] = React.useState<TaskPriority>('normal');
  const [note, setNote] = React.useState('');
  const [deadlineDate, setDeadlineDate] = React.useState('');
  const [durationSec, setDurationSec] = React.useState(() => defaultDurationSec);
  const [durationUnit, setDurationUnit] = React.useState<DurationUnit>(() => getDurationUnitFromSec(defaultDurationSec));
  const [presetLabel, setPresetLabel] = React.useState<string | undefined>(() => getDurationPresetLabel(defaultDurationSec, defaultDurationPreset.id));
  const [pomoCycles, setPomoCycles] = React.useState(settings.timer.pomodoroDefaults.cycles);
  const [pomoWorkMin, setPomoWorkMin] = React.useState(settings.timer.pomodoroDefaults.workDurationMin);
  const [pomoShortBreakMin, setPomoShortBreakMin] = React.useState(settings.timer.pomodoroDefaults.shortBreakMin);
  const [pomoLongBreakMin, setPomoLongBreakMin] = React.useState(settings.timer.pomodoroDefaults.longBreakMin);
  const [autoEnabled, setAutoEnabled] = React.useState(settings.general.autoStartTimerWhenTaskCreated);
  const [playEnabled, setPlayEnabled] = React.useState(true);
  const [autoResetEnabled, setAutoResetEnabled] = React.useState(false);
  const [overdueEnabled, setOverdueEnabled] = React.useState(false);
  const [presetOpen, setPresetOpen] = React.useState(false);
  const [modeOpen, setModeOpen] = React.useState(false);
  const [advancedModeOpen, setAdvancedModeOpen] = React.useState(false);
  const [workspaceOpen, setWorkspaceOpen] = React.useState(false);
  const [workspaceOverride, setWorkspaceOverride] = React.useState<AssignableWorkspaceType | undefined>(undefined);

  const localInputRef = React.useRef<HTMLInputElement | null>(null);

  const setInputRef = React.useCallback((element: HTMLInputElement | null) => {
    localInputRef.current = element;
    if (!forwardedRef) return;

    if (typeof forwardedRef === 'function') {
      forwardedRef(element);
    } else {
      forwardedRef.current = element;
    }
  }, [forwardedRef]);

  const focusInput = React.useCallback(() => {
    requestAnimationFrame(() => localInputRef.current?.focus());
  }, []);

  const applyPomodoroPreset = React.useCallback((preset: ReturnType<typeof getVisiblePomodoroPresetById>) => {
    setPomodoroPresetId(preset.id);
    setPomoCycles(preset.cycles);
    setPomoWorkMin(preset.workDurationMin);
    setPomoShortBreakMin(preset.shortBreakMin);
    setPomoLongBreakMin(preset.longBreakMin);
  }, []);

  const applyDeadlinePreset = React.useCallback((preset: ReturnType<typeof getVisibleDeadlinePresetById>) => {
    setDeadlinePresetId(preset.id);
    setDeadlineDate(buildDeadlineLocalValue(preset.offsetSec));
  }, []);

  const resolvedCurrentWorkspace = React.useMemo(
    () => resolveCurrentWorkspaceContext({
      workspaces,
      currentWorkspace: state.workspace,
      lastConcreteWorkspace: state.lastConcreteWorkspace,
      fallbackWorkspace: settings.general.defaultWorkspace,
      defaultWorkspace,
    }),
    [defaultWorkspace, settings.general.defaultWorkspace, state.lastConcreteWorkspace, state.workspace, workspaces],
  );

  const hasLastSelectedWorkspace = React.useMemo(
    () => state.workspace === 'all' && hasWorkspace(workspaces, state.lastConcreteWorkspace),
    [state.lastConcreteWorkspace, state.workspace, workspaces],
  );

  const currentWorkspaceLabel = React.useMemo(
    () => getWorkspaceLabel(workspaces, resolvedCurrentWorkspace),
    [resolvedCurrentWorkspace, workspaces],
  );
  const currentWorkspaceOptionLabel = hasLastSelectedWorkspace
    ? `Use last selected (${currentWorkspaceLabel})`
    : `Use current (${currentWorkspaceLabel})`;

  const showWorkspaceDropdown = hasWorkspaceTabs && (state.workspace === 'all' || workspaces.length > 1);
  const showWorkspaceEmptyState = !hasWorkspaceTabs;
  const fallbackWorkspaceLabel = React.useMemo(
    () => getWorkspaceLabel(workspaces, settings.general.defaultWorkspace),
    [settings.general.defaultWorkspace, workspaces],
  );
  const workspaceHelperText = showWorkspaceEmptyState
    ? `Only “All” remains. Create a workspace tab to choose a destination. Until then, new tasks fall back to ${fallbackWorkspaceLabel}.`
    : showWorkspaceDropdown
      ? 'Choose a different workspace without changing the current task list context.'
      : 'Only one workspace tab is available, so new tasks will use the current workspace.';

  const resetComposerToSettingsDefaults = React.useCallback(() => {
    setPresetId(defaultDurationPreset.id);
    setPomodoroPresetId(defaultPomodoroPreset.id);
    setDeadlinePresetId(defaultDeadlinePreset.id);
    setTimerMode(settings.timer.defaultMode);
    setPriority('normal');
    setNote('');
    setDurationSec(defaultDurationSec);
    setDurationUnit(getDurationUnitFromSec(defaultDurationSec));
    setPresetLabel(getDurationPresetLabel(defaultDurationSec, defaultDurationPreset.id));
    setAutoEnabled(settings.general.autoStartTimerWhenTaskCreated);
    setPlayEnabled(true);
    setAutoResetEnabled(false);
    setOverdueEnabled(false);
    setWorkspaceOverride(undefined);
    setWorkspaceOpen(false);
    setPomoCycles(settings.timer.pomodoroDefaults.cycles);
    setPomoWorkMin(settings.timer.pomodoroDefaults.workDurationMin);
    setPomoShortBreakMin(settings.timer.pomodoroDefaults.shortBreakMin);
    setPomoLongBreakMin(settings.timer.pomodoroDefaults.longBreakMin);
    setDeadlineDate(buildDeadlineLocalValue(settings.timer.deadlineDefaults.offsetSec));
  }, [
    defaultDeadlinePreset.id,
    defaultDurationSec,
    defaultDurationPreset.id,
    defaultPomodoroPreset.id,
    settings.general.autoStartTimerWhenTaskCreated,
    settings.timer.deadlineDefaults.offsetSec,
    settings.timer.defaultMode,
    settings.timer.pomodoroDefaults.cycles,
    settings.timer.pomodoroDefaults.longBreakMin,
    settings.timer.pomodoroDefaults.shortBreakMin,
    settings.timer.pomodoroDefaults.workDurationMin,
  ]);

  React.useEffect(() => {
    if (!workspaceOverride) return;
    if (hasWorkspace(workspaces, workspaceOverride)) return;

    setWorkspaceOverride(undefined);
  }, [workspaceOverride, workspaces]);

  React.useEffect(() => {
    if (!showWorkspaceDropdown && workspaceOpen) {
      setWorkspaceOpen(false);
    }
  }, [showWorkspaceDropdown, workspaceOpen]);

  React.useEffect(() => {
    if (!areSettingsHydrated) return;
    if (title.trim() || note.trim()) return;

    resetComposerToSettingsDefaults();
  }, [areSettingsHydrated, note, resetComposerToSettingsDefaults, title]);

  const applyDurationPreset = React.useCallback((preset: ReturnType<typeof getVisibleDurationPresetById>) => {
    setDurationSec(preset.durationSec);
    setDurationUnit(getDurationUnitFromSec(preset.durationSec));
    setPresetLabel(preset.label);
  }, []);

  const handleSubmit = React.useCallback((event?: React.FormEvent) => {
    event?.preventDefault();

    if (!title.trim()) return;

    addTask(buildCreateTaskInput({
      title,
      note,
      defaultWorkspace,
      workspaceOverride,
      currentWorkspace: state.workspace,
      lastConcreteWorkspace: state.lastConcreteWorkspace,
      workspaces,
      fallbackWorkspace: settings.general.defaultWorkspace,
      priority,
      timerMode,
      durationSec,
      deadlineDate,
      autoEnabled,
      playEnabled,
      autoResetEnabled,
      overdueEnabled,
      pomoCycles,
      pomoWorkMin,
      pomoShortBreakMin,
      pomoLongBreakMin,
    }));

    setTitle('');
    resetComposerToSettingsDefaults();
    setIsNoteExpanded(false);
    setShowMore(false);
    setModeOpen(false);
    setAdvancedModeOpen(false);
    setPresetOpen(false);

    try {
      localInputRef.current?.focus();
    } catch {}
  }, [
    addTask,
    autoEnabled,
    autoResetEnabled,
    deadlineDate,
    defaultWorkspace,
    durationSec,
    note,
    overdueEnabled,
    playEnabled,
    pomoCycles,
    pomoLongBreakMin,
    pomoShortBreakMin,
    pomoWorkMin,
    priority,
    resetComposerToSettingsDefaults,
    settings.general.defaultWorkspace,
    state.lastConcreteWorkspace,
    state.workspace,
    timerMode,
    title,
    workspaceOverride,
    workspaces,
  ]);

  const handleModeSelect = React.useCallback((mode: TimerMode) => {
    setTimerMode(mode);
    setModeOpen(false);
    setAdvancedModeOpen(false);
    setPresetOpen(false);

    if (mode === 'pomodoro') {
      setPomodoroPresetId(defaultPomodoroPreset.id);
      setPomoCycles(settings.timer.pomodoroDefaults.cycles);
      setPomoWorkMin(settings.timer.pomodoroDefaults.workDurationMin);
      setPomoShortBreakMin(settings.timer.pomodoroDefaults.shortBreakMin);
      setPomoLongBreakMin(settings.timer.pomodoroDefaults.longBreakMin);
    } else if (mode === 'deadline') {
      setDeadlinePresetId(defaultDeadlinePreset.id);
      setDeadlineDate(buildDeadlineLocalValue(settings.timer.deadlineDefaults.offsetSec));
    } else {
      setPresetId(defaultDurationPreset.id);
      setDurationSec(settings.timer.durationDefaults.durationSec);
      setDurationUnit(getDurationUnitFromSec(settings.timer.durationDefaults.durationSec));
      setPresetLabel(getDurationPresetLabel(settings.timer.durationDefaults.durationSec, defaultDurationPreset.id));
    }

    focusInput();
  }, [
    defaultDeadlinePreset.id,
    defaultDurationPreset.id,
    defaultPomodoroPreset.id,
    focusInput,
    settings.timer.deadlineDefaults.offsetSec,
    settings.timer.durationDefaults.durationSec,
    settings.timer.pomodoroDefaults.cycles,
    settings.timer.pomodoroDefaults.longBreakMin,
    settings.timer.pomodoroDefaults.shortBreakMin,
    settings.timer.pomodoroDefaults.workDurationMin,
  ]);

  const presetOptions: DropdownOption[] = [
    ...visibleDurationPresets.map((preset) => ({ id: preset.id, label: preset.label })),
    ...(hasCustomDurationDefault
      ? [{ id: CUSTOM_DURATION_PRESET_ID, label: formatCompactDurationLabel(defaultDurationSec) }]
      : []),
  ];
  const pomodoroPresetOptions: DropdownOption[] = [
    ...visiblePomodoroPresets.map((preset) => ({ id: preset.id, label: formatNamedPomodoroPresetLabel(preset) })),
    ...(hasCustomPomodoroDefault
      ? [{
          id: CUSTOM_POMODORO_PRESET_ID,
          label: `Custom · ${formatPomodoroPresetLabel(settings.timer.pomodoroDefaults)}`,
        }]
      : []),
  ];
  const deadlinePresetOptions: DropdownOption[] = [
    ...visibleDeadlinePresets.map((preset) => ({ id: preset.id, label: preset.label })),
    ...(hasCustomDeadlineDefault
      ? [{ id: CUSTOM_DEADLINE_PRESET_ID, label: formatDeadlineOffsetLabel(settings.timer.deadlineDefaults.offsetSec) }]
      : []),
  ];
  const workspaceOptions: DropdownOption[] = [
    {
      id: USE_CURRENT_WORKSPACE_OPTION_ID,
      label: currentWorkspaceOptionLabel,
    },
    ...workspaces.map((workspace) => ({
      id: workspace.id,
      label: workspace.label,
    })),
  ];

  const customDurationLabel = formatCompactDurationLabel(durationSec);
  const safeDurationPresetId = visibleDurationPresets.some((preset) => preset.id === presetId)
    ? presetId
    : defaultDurationPreset.id;
  const safePomodoroPresetId = visiblePomodoroPresets.some((preset) => preset.id === pomodoroPresetId)
    ? pomodoroPresetId
    : defaultPomodoroPreset.id;
  const safeDeadlinePresetId = visibleDeadlinePresets.some((preset) => preset.id === deadlinePresetId)
    ? deadlinePresetId
    : defaultDeadlinePreset.id;
  const isUsingCustomDurationDefault = hasCustomDurationDefault && durationSec === settings.timer.durationDefaults.durationSec;
  const matchedPomodoroPreset = visiblePomodoroPresets.find((preset) => (
    preset.cycles === pomoCycles &&
    preset.workDurationMin === pomoWorkMin &&
    preset.shortBreakMin === pomoShortBreakMin &&
    preset.longBreakMin === pomoLongBreakMin
  ));
  const isUsingCustomPomodoroDefault = hasCustomPomodoroDefault &&
    pomoCycles === settings.timer.pomodoroDefaults.cycles &&
    pomoWorkMin === settings.timer.pomodoroDefaults.workDurationMin &&
    pomoShortBreakMin === settings.timer.pomodoroDefaults.shortBreakMin &&
    pomoLongBreakMin === settings.timer.pomodoroDefaults.longBreakMin;
  const hasCustomPomodoroSelection = !matchedPomodoroPreset;
  const isUsingCustomDeadlineDefault = hasCustomDeadlineDefault && getApproxDeadlineOffsetSec(deadlineDate) === settings.timer.deadlineDefaults.offsetSec;
  const currentPomodoroConfig = {
    cycles: pomoCycles,
    workDurationMin: pomoWorkMin,
    shortBreakMin: pomoShortBreakMin,
    longBreakMin: pomoLongBreakMin,
  };

  const currentPresetLabel =
    timerMode === 'pomodoro'
      ? (hasCustomPomodoroSelection
          ? `Custom · ${formatPomodoroPresetLabel(currentPomodoroConfig)}`
          : formatNamedPomodoroPresetLabel(matchedPomodoroPreset ?? defaultPomodoroPreset))
      : presetLabel ?? customDurationLabel;
  const currentPresetTriggerLabel =
    timerMode === 'pomodoro'
      ? (hasCustomPomodoroSelection
          ? 'Custom'
          : getPomodoroPresetTriggerLabel((matchedPomodoroPreset ?? defaultPomodoroPreset).label))
      : currentPresetLabel;
  const currentPresetOptions = timerMode === 'pomodoro' ? pomodoroPresetOptions : presetOptions;
  const currentPresetId = timerMode === 'pomodoro'
    ? (isUsingCustomPomodoroDefault ? CUSTOM_POMODORO_PRESET_ID : safePomodoroPresetId)
    : (isUsingCustomDurationDefault ? CUSTOM_DURATION_PRESET_ID : safeDurationPresetId);
  const deadlinePresetLabel = isUsingCustomDeadlineDefault
    ? formatDeadlineOffsetLabel(settings.timer.deadlineDefaults.offsetSec)
    : visibleDeadlinePresets.find((preset) => preset.id === safeDeadlinePresetId)?.label ?? 'Preset';
  const selectedDeadlinePresetId = isUsingCustomDeadlineDefault ? CUSTOM_DEADLINE_PRESET_ID : safeDeadlinePresetId;
  const selectedWorkspaceOptionId = workspaceOverride ?? USE_CURRENT_WORKSPACE_OPTION_ID;
  const selectedWorkspaceLabel = showWorkspaceEmptyState
    ? 'No workspace tabs available'
    : workspaceOverride
      ? getWorkspaceLabel(workspaces, workspaceOverride)
      : showWorkspaceDropdown
        ? currentWorkspaceOptionLabel
        : currentWorkspaceLabel;

  const handlePresetSelect = React.useCallback((id: string) => {
    if (timerMode === 'pomodoro') {
      if (id === CUSTOM_POMODORO_PRESET_ID) {
        setPomodoroPresetId(defaultPomodoroPreset.id);
        setPomoCycles(settings.timer.pomodoroDefaults.cycles);
        setPomoWorkMin(settings.timer.pomodoroDefaults.workDurationMin);
        setPomoShortBreakMin(settings.timer.pomodoroDefaults.shortBreakMin);
        setPomoLongBreakMin(settings.timer.pomodoroDefaults.longBreakMin);
        setPresetOpen(false);
        focusInput();
        return;
      }

      applyPomodoroPreset(getVisiblePomodoroPresetById(id, settings.timer.hiddenPomodoroPresetIds));
      setPresetOpen(false);
      focusInput();
      return;
    }

    if (id === CUSTOM_DURATION_PRESET_ID) {
      setPresetId(defaultDurationPreset.id);
      setDurationSec(settings.timer.durationDefaults.durationSec);
      setDurationUnit(getDurationUnitFromSec(settings.timer.durationDefaults.durationSec));
      setPresetLabel(undefined);
      setPresetOpen(false);
      focusInput();
      return;
    }

    setPresetId(id as DurationPresetId);
    applyDurationPreset(getVisibleDurationPresetById(id, settings.timer.hiddenDurationPresetIds));
    setPresetOpen(false);
    focusInput();
  }, [
    applyDurationPreset,
    applyPomodoroPreset,
    defaultDurationPreset.id,
    defaultPomodoroPreset.id,
    focusInput,
    settings.timer.durationDefaults.durationSec,
    settings.timer.hiddenDurationPresetIds,
    settings.timer.hiddenPomodoroPresetIds,
    settings.timer.pomodoroDefaults.cycles,
    settings.timer.pomodoroDefaults.longBreakMin,
    settings.timer.pomodoroDefaults.shortBreakMin,
    settings.timer.pomodoroDefaults.workDurationMin,
    timerMode,
  ]);

  const handleDeadlinePresetSelect = React.useCallback((id: string) => {
    if (id === CUSTOM_DEADLINE_PRESET_ID) {
      setDeadlinePresetId(defaultDeadlinePreset.id);
      setDeadlineDate(buildDeadlineLocalValue(settings.timer.deadlineDefaults.offsetSec));
      setPresetOpen(false);
      focusInput();
      return;
    }

    applyDeadlinePreset(getVisibleDeadlinePresetById(id, settings.timer.hiddenDeadlinePresetIds));
    setPresetOpen(false);
    focusInput();
  }, [
    applyDeadlinePreset,
    defaultDeadlinePreset.id,
    focusInput,
    settings.timer.deadlineDefaults.offsetSec,
    settings.timer.hiddenDeadlinePresetIds,
  ]);

  const handleWorkspaceOverrideSelect = React.useCallback((id: string) => {
    setWorkspaceOverride(id === USE_CURRENT_WORKSPACE_OPTION_ID ? undefined : id as AssignableWorkspaceType);
    setWorkspaceOpen(false);
    focusInput();
  }, [focusInput]);

  const handleAutoResetChange = React.useCallback((enabled: boolean) => {
    setAutoResetEnabled(enabled);
    if (enabled && overdueEnabled) {
      setOverdueEnabled(false);
    }
  }, [overdueEnabled]);

  const handleOverdueChange = React.useCallback((enabled: boolean) => {
    setOverdueEnabled(enabled);
    if (enabled && autoResetEnabled) {
      setAutoResetEnabled(false);
    }
  }, [autoResetEnabled]);

  const handleDurationSecChange = React.useCallback((nextDurationSec: number) => {
    setDurationSec(nextDurationSec);
    setPresetLabel(undefined);
  }, []);

  const handleDurationUnitChange = React.useCallback((unit: DurationUnit) => {
    setDurationUnit(unit);

    const lastSelectedPreset = visibleDurationPresets.find((preset) => preset.id === presetId);
    if (
      lastSelectedPreset &&
      lastSelectedPreset.durationSec === durationSec &&
      getDurationUnitFromSec(durationSec) === unit
    ) {
      setPresetLabel(lastSelectedPreset.label);
    } else {
      setPresetLabel(undefined);
    }
  }, [durationSec, presetId, visibleDurationPresets]);

  const handleCancelDetails = React.useCallback(() => {
    setShowMore(false);
    setPresetOpen(false);
    setModeOpen(false);
    setAdvancedModeOpen(false);
    setWorkspaceOpen(false);
    focusInput();
  }, [focusInput, setWorkspaceOpen]);

  const handleResetDetails = React.useCallback(() => {
    resetComposerToSettingsDefaults();
    focusInput();
  }, [focusInput, resetComposerToSettingsDefaults]);

  return {
    title,
    setTitle,
    setInputRef,
    isNoteExpanded,
    setIsNoteExpanded,
    toggleNote: () => setIsNoteExpanded((current) => !current),
    showMore,
    setShowMore,
    toggleMore: () => setShowMore((current) => !current),
    timerMode,
    priority,
    note,
    durationSec,
    durationUnit,
    deadlineDate,
    pomoCycles,
    pomoWorkMin,
    pomoShortBreakMin,
    pomoLongBreakMin,
    autoEnabled,
    playEnabled,
    autoResetEnabled,
    overdueEnabled,
    presetLabel,
    workspaceOpen,
    setWorkspaceOpen,
    showWorkspaceDropdown,
    showWorkspaceEmptyState,
    workspaceHelperText,
    workspaceOptions,
    selectedWorkspaceOptionId,
    selectedWorkspaceLabel,
    modeOpen,
    setModeOpen,
    advancedModeOpen,
    setAdvancedModeOpen,
    presetOpen,
    setPresetOpen,
    currentPresetLabel,
    currentPresetTriggerLabel,
    currentPresetOptions,
    currentPresetId,
    deadlinePresetLabel,
    deadlinePresetOptions,
    selectedDeadlinePresetId,
    canSubmit: title.trim().length > 0,
    handleSubmit,
    handleModeSelect,
    handlePresetSelect,
    handleDeadlinePresetSelect,
    handleWorkspaceOverrideSelect,
    handleDurationSecChange,
    handleDurationUnitChange,
    handleAutoResetChange,
    handleOverdueChange,
    handleCancelDetails,
    handleResetDetails,
    setPriority,
    setNote,
    setDeadlineDate,
    setPomoCycles,
    setPomoWorkMin,
    setPomoShortBreakMin,
    setPomoLongBreakMin,
    setAutoEnabled,
    setPlayEnabled,
  };
}

