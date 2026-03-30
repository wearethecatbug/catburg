'use client';

import React, { useState, forwardRef, useRef, useEffect } from 'react';
import { getSafeDefaultWorkspace } from '@/domain/workspace';
import {
    DEADLINE_PRESETS,
    formatDeadlineOffsetLabel,
    formatNamedPomodoroPresetLabel,
    formatPomodoroPresetLabel,
    getVisibleDeadlinePresetById,
    getVisibleDeadlinePresets,
    getVisiblePomodoroPresetById,
    getVisiblePomodoroPresets,
    POMODORO_PRESETS,
    type DeadlinePresetId,
    type PomodoroPresetId,
} from '@/domain/timer.presets';
import { useSettings, useTasks } from '@/store';
import { TASK_NOTE_MAX_LENGTH, type WorkspaceType, type CreateTaskInput, type TaskPriority, type TimerMode } from '@/domain/task.types';
import {
    DURATION_PRESETS,
    formatDurationValue,
    getDurationPresetById,
    getVisibleDurationPresetById,
    getVisibleDurationPresets,
    type DurationPresetId,
    type DurationUnit,
} from '@/domain/duration';
import {
    PlusIcon,
    ClockIcon,
    ChevronDownIcon,
    HourglassIcon,
    CalendarIcon,
    PomodoroIcon,
    usePersistedWorkspaces,
} from '@/shared';
import { Dropdown, DetailsPanel, type DropdownOption } from './components';

interface AddTaskInputProps {
    defaultWorkspace?: WorkspaceType;
}

function getDurationUnitFromSec(valueSec: number): DurationUnit {
    if (valueSec % 86400 === 0) return 'd';
    if (valueSec % 3600 === 0) return 'h';
    return 'min';
}

function formatCompactDurationLabel(durationSec: number): string {
    const unit = getDurationUnitFromSec(durationSec);
    const unitLabel = unit === 'min' ? 'm' : unit;
    return `${formatDurationValue(durationSec, unit)}${unitLabel}`;
}

function getApproxDeadlineOffsetSec(localValue: string): number | null {
    if (!localValue) return null;

    const target = new Date(`${localValue}:00`);
    if (Number.isNaN(target.getTime())) return null;

    const diffMs = target.getTime() - Date.now();
    return Math.max(60, Math.round(diffMs / 60000) * 60);
}

const PRESETS = DURATION_PRESETS;
const CUSTOM_DURATION_PRESET_ID = '__custom-duration-default__';
const CUSTOM_POMODORO_PRESET_ID = '__custom-pomodoro-default__';
const CUSTOM_DEADLINE_PRESET_ID = '__custom-deadline-default__';

function getDurationPresetLabel(durationSec: number, presetId: DurationPresetId): string | undefined {
    const preset = getDurationPresetById(presetId);
    return preset.durationSec === durationSec ? preset.label : undefined;
}

export const AddTaskInput = forwardRef<HTMLInputElement, AddTaskInputProps>(function AddTaskInput(
    { defaultWorkspace },
    ref,
) {
    const { settings, isHydrated: areSettingsHydrated } = useSettings();
    const { addTask, state } = useTasks();
    const { workspaces } = usePersistedWorkspaces();
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

    const [value, setValue] = useState('');
    const [presetId, setPresetId] = useState<DurationPresetId>(() => defaultDurationPreset.id);
    const [pomodoroPresetId, setPomodoroPresetId] = useState<PomodoroPresetId>(() => defaultPomodoroPreset.id);
    const [deadlinePresetId, setDeadlinePresetId] = useState<DeadlinePresetId>(() => defaultDeadlinePreset.id);
    const [showDetails, setShowDetails] = useState(false);

    const [timerMode, setTimerMode] = useState<TimerMode>(settings.timer.defaultMode);
    const [priority, setPriority] = useState<TaskPriority>('normal');
    const [note, setNote] = useState('');
    const [deadlineDate, setDeadlineDate] = useState('');

    const [durationSec, setDurationSec] = useState(() => defaultDurationSec);
    const [durationUnit, setDurationUnit] = useState<DurationUnit>(() => getDurationUnitFromSec(defaultDurationSec));
    const [presetLabel, setPresetLabel] = useState<string | undefined>(() => getDurationPresetLabel(defaultDurationSec, defaultDurationPreset.id));

    const [pomoCycles, setPomoCycles] = useState(settings.timer.pomodoroDefaults.cycles);
    const [pomoWorkMin, setPomoWorkMin] = useState(settings.timer.pomodoroDefaults.workDurationMin);
    const [pomoShortBreakMin, setPomoShortBreakMin] = useState(settings.timer.pomodoroDefaults.shortBreakMin);
    const [pomoLongBreakMin, setPomoLongBreakMin] = useState(settings.timer.pomodoroDefaults.longBreakMin);

    const [autoEnabled, setAutoEnabled] = useState(settings.general.autoStartTimerWhenTaskCreated);
    const [playEnabled, setPlayEnabled] = useState(true);
    const [autoResetEnabled, setAutoResetEnabled] = useState(false);
    const [overdueEnabled, setOverdueEnabled] = useState(false);

    const localInputRef = useRef<HTMLInputElement | null>(null);

    const [presetOpen, setPresetOpen] = useState(false);
    const [modeOpen, setModeOpen] = useState(false);

    const setRef = (el: HTMLInputElement | null) => {
        localInputRef.current = el;
        if (!ref) return;

        if (typeof ref === 'function') {
            ref(el);
        } else {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
        }
    };

    const applyPomodoroPreset = React.useCallback((preset: (typeof POMODORO_PRESETS)[number]) => {
        setPomodoroPresetId(preset.id);
        setPomoCycles(preset.cycles);
        setPomoWorkMin(preset.workDurationMin);
        setPomoShortBreakMin(preset.shortBreakMin);
        setPomoLongBreakMin(preset.longBreakMin);
    }, []);

    const applyDeadlinePreset = React.useCallback((preset: (typeof DEADLINE_PRESETS)[number]) => {
        setDeadlinePresetId(preset.id);
        setDeadlineDate(buildDeadlineLocalValue(preset.offsetSec));
    }, []);

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
        setPomoCycles(settings.timer.pomodoroDefaults.cycles);
        setPomoWorkMin(settings.timer.pomodoroDefaults.workDurationMin);
        setPomoShortBreakMin(settings.timer.pomodoroDefaults.shortBreakMin);
        setPomoLongBreakMin(settings.timer.pomodoroDefaults.longBreakMin);
        setDeadlineDate(buildDeadlineLocalValue(settings.timer.deadlineDefaults.offsetSec));
    }, [
        defaultDeadlinePreset,
        defaultDurationSec,
        defaultDurationPreset,
        defaultPomodoroPreset,
        settings.general.autoStartTimerWhenTaskCreated,
        settings.timer.deadlineDefaults.offsetSec,
        settings.timer.defaultMode,
        settings.timer.pomodoroDefaults.cycles,
        settings.timer.pomodoroDefaults.longBreakMin,
        settings.timer.pomodoroDefaults.shortBreakMin,
        settings.timer.pomodoroDefaults.workDurationMin,
    ]);

    useEffect(() => {
        if (!areSettingsHydrated) return;
        if (value.trim() || note.trim()) return;

        resetComposerToSettingsDefaults();
    }, [areSettingsHydrated, note, resetComposerToSettingsDefaults, value]);

    const applyDurationPreset = (preset: (typeof PRESETS)[number]) => {
        setDurationSec(preset.durationSec);
        setDurationUnit(getDurationUnitFromSec(preset.durationSec));
        setPresetLabel(preset.label);
    };

    const buildDeadlineLocalValue = (offsetSec: number) => {
        const now = new Date();
        now.setSeconds(now.getSeconds() + offsetSec);

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();

        const title = value.trim();
        if (!title) return;

        const nextDurationSec =
            timerMode === 'deadline'
                ? undefined
                : timerMode === 'pomodoro'
                    ? Math.max(1, Math.floor(Number(pomoWorkMin))) * 60
                    : durationSec;

        let targetAt: string | undefined = undefined;
        if (timerMode === 'deadline' && deadlineDate) {
            const localDate = new Date(deadlineDate + ':00');
            targetAt = localDate.toISOString();
        }

        const taskData: CreateTaskInput = {
            title,
            note: note.trim().slice(0, TASK_NOTE_MAX_LENGTH) || undefined,
            workspace:
                defaultWorkspace ??
                (state.workspace === 'all'
                    ? getSafeDefaultWorkspace(workspaces, settings.general.defaultWorkspace)
                    : state.workspace),
            priority,
            timerMode,
            durationSec: nextDurationSec,
            targetAt,
            timerControls: {
                autoStart: autoEnabled,
                autoPlay: playEnabled,
                autoReset: autoResetEnabled,
                allowOverdue: overdueEnabled,
            },
        };

        if (timerMode === 'pomodoro') {
            taskData.pomodoro = {
                cycles: Math.max(1, Math.floor(Number(pomoCycles))),
                workDurationMin: Math.max(1, Math.floor(Number(pomoWorkMin))),
                shortBreakMin: Math.max(1, Math.floor(Number(pomoShortBreakMin))),
                longBreakMin: Math.max(1, Math.floor(Number(pomoLongBreakMin))),
                autoStart: autoEnabled,
                autoPlay: playEnabled,
            };
        }

        addTask(taskData);

        setValue('');
        resetComposerToSettingsDefaults();

        try {
            localInputRef.current?.focus();
        } catch {}
    };

    const onPresetSelect = (id: DurationPresetId) => {
        setPresetId(id);

        applyDurationPreset(getVisibleDurationPresetById(id, settings.timer.hiddenDurationPresetIds));

        setPresetOpen(false);
        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    const onModeSelect = (mode: TimerMode) => {
        setTimerMode(mode);
        setModeOpen(false);

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

        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    const modeOptions: DropdownOption[] = [
        { id: 'duration', label: 'Duration', icon: <HourglassIcon size="sm" /> },
        { id: 'pomodoro', label: 'Pomodoro', icon: <PomodoroIcon size="sm" /> },
        { id: 'deadline', label: 'Deadline', icon: <CalendarIcon size="sm" /> },
    ];

    const presetOptions: DropdownOption[] = [
        ...visibleDurationPresets.map((p) => ({ id: p.id, label: p.label })),
        ...(hasCustomDurationDefault
            ? [{ id: CUSTOM_DURATION_PRESET_ID, label: formatCompactDurationLabel(defaultDurationSec) }]
            : []),
    ];
    const pomodoroPresetOptions: DropdownOption[] = [
        ...visiblePomodoroPresets.map((p) => ({ id: p.id, label: formatNamedPomodoroPresetLabel(p) })),
        ...(hasCustomPomodoroDefault
            ? [{
                id: CUSTOM_POMODORO_PRESET_ID,
                label: `Custom · ${formatPomodoroPresetLabel(settings.timer.pomodoroDefaults)}`,
            }]
            : []),
    ];
    const deadlinePresetOptions: DropdownOption[] = [
        ...visibleDeadlinePresets.map((p) => ({ id: p.id, label: p.label })),
        ...(hasCustomDeadlineDefault
            ? [{ id: CUSTOM_DEADLINE_PRESET_ID, label: formatDeadlineOffsetLabel(settings.timer.deadlineDefaults.offsetSec) }]
            : []),
    ];

    const ModeIcon =
        timerMode === 'duration'
            ? HourglassIcon
            : timerMode === 'deadline'
                ? CalendarIcon
                : PomodoroIcon;

    const modeLabel =
        timerMode === 'duration'
            ? 'Duration'
            : timerMode === 'deadline'
                ? 'Deadline'
                : 'Pomodoro';

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

    const currentPresetOptions = timerMode === 'pomodoro' ? pomodoroPresetOptions : presetOptions;
    const currentPresetId = timerMode === 'pomodoro'
        ? (isUsingCustomPomodoroDefault ? CUSTOM_POMODORO_PRESET_ID : safePomodoroPresetId)
        : (isUsingCustomDurationDefault ? CUSTOM_DURATION_PRESET_ID : safeDurationPresetId);

    const handlePresetSelect = (id: string) => {
        if (timerMode === 'pomodoro') {
            if (id === CUSTOM_POMODORO_PRESET_ID) {
                setPomodoroPresetId(defaultPomodoroPreset.id);
                setPomoCycles(settings.timer.pomodoroDefaults.cycles);
                setPomoWorkMin(settings.timer.pomodoroDefaults.workDurationMin);
                setPomoShortBreakMin(settings.timer.pomodoroDefaults.shortBreakMin);
                setPomoLongBreakMin(settings.timer.pomodoroDefaults.longBreakMin);
                setPresetOpen(false);
                requestAnimationFrame(() => localInputRef.current?.focus());
                return;
            }

            applyPomodoroPreset(getVisiblePomodoroPresetById(id, settings.timer.hiddenPomodoroPresetIds));

            setPresetOpen(false);
            requestAnimationFrame(() => localInputRef.current?.focus());
            return;
        }

        if (id === CUSTOM_DURATION_PRESET_ID) {
            setPresetId(defaultDurationPreset.id);
            setDurationSec(settings.timer.durationDefaults.durationSec);
            setDurationUnit(getDurationUnitFromSec(settings.timer.durationDefaults.durationSec));
            setPresetLabel(undefined);
            setPresetOpen(false);
            requestAnimationFrame(() => localInputRef.current?.focus());
            return;
        }

        onPresetSelect(id as DurationPresetId);
    };

    const handleDeadlinePresetSelect = (id: string) => {
        if (id === CUSTOM_DEADLINE_PRESET_ID) {
            setDeadlinePresetId(defaultDeadlinePreset.id);
            setDeadlineDate(buildDeadlineLocalValue(settings.timer.deadlineDefaults.offsetSec));
            setPresetOpen(false);
            requestAnimationFrame(() => localInputRef.current?.focus());
            return;
        }

        applyDeadlinePreset(getVisibleDeadlinePresetById(id, settings.timer.hiddenDeadlinePresetIds));

        setPresetOpen(false);
        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    const handleAutoResetChange = (enabled: boolean) => {
        setAutoResetEnabled(enabled);
        if (enabled && overdueEnabled) {
            setOverdueEnabled(false);
        }
    };

    const handleOverdueChange = (enabled: boolean) => {
        setOverdueEnabled(enabled);
        if (enabled && autoResetEnabled) {
            setAutoResetEnabled(false);
        }
    };

    const handleDurationSecChange = (value: number) => {
        setDurationSec(value);
        // When duration is manually edited, always clear the preset label to indicate a custom value,
        // even if the new duration happens to numerically match one of the presets.
        setPresetLabel(undefined);
    };

    const handleDurationUnitChange = (unit: DurationUnit) => {
        setDurationUnit(unit);

        // Note: presetId tracks the 'last selected preset from the dropdown', NOT the current duration state.
        // If the user manually edited the duration, presetId may not match durationSec.
        // Only restore the preset label if the current duration matches the last-selected preset AND
        // the unit is canonical for that preset. This prevents showing "Preset: 10m" when the dropdown shows "25m"
        // (which would happen if the user manually changed duration to 10m, then toggled units).
        const lastSelectedPreset = PRESETS.find((p) => p.id === presetId);
        if (
            lastSelectedPreset &&
            lastSelectedPreset.durationSec === durationSec &&
            getDurationUnitFromSec(durationSec) === unit
        ) {
            // Current duration exactly matches the last-selected preset in its canonical unit
            // → restore the label to indicate we're still viewing that preset
            setPresetLabel(lastSelectedPreset.label);
        } else {
            // Either: (a) user manually changed duration away from the preset,
            // or (b) unit is non-canonical for the last-selected preset
            // → clear the label to avoid misleading the user
            setPresetLabel(undefined);
        }
    };

    return (
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <label className="sr-only" htmlFor="task-title">
                        Task title
                    </label>
                    <input
                        id="task-title"
                        ref={setRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Add a new task..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Add a new task"
                    />
                </div>

                <Dropdown
                    id="task-mode-btn"
                    label="Timer mode"
                    icon={<ModeIcon size="sm" />}
                    buttonContent={
                        <>
                            <span className="whitespace-nowrap">{modeLabel}</span>
                            <ChevronDownIcon size="sm" />
                        </>
                    }
                    options={modeOptions}
                    selectedId={timerMode}
                    isOpen={modeOpen}
                    onToggle={() => setModeOpen((s) => !s)}
                    onSelect={(id) => onModeSelect(id as TimerMode)}
                    onClose={() => setModeOpen(false)}
                    title="Timer mode"
                    ariaLabel="Timer mode options"
                />

                {timerMode !== 'deadline' && (
                    <Dropdown
                        id="task-preset-btn"
                        label={timerMode === 'pomodoro' ? 'Pomodoro preset' : 'Preset duration'}
                        icon={<ClockIcon size="sm" />}
                        buttonContent={
                            <>
                                <span className="whitespace-nowrap">{currentPresetLabel}</span>
                                <ChevronDownIcon size="sm" />
                            </>
                        }
                        options={currentPresetOptions}
                        selectedId={currentPresetId}
                        isOpen={presetOpen}
                        onToggle={() => setPresetOpen((s) => !s)}
                        onSelect={handlePresetSelect}
                        onClose={() => setPresetOpen(false)}
                        title={timerMode === 'pomodoro' ? 'Pomodoro preset' : 'Preset duration'}
                    />
                )}

                {timerMode === 'deadline' && (
                    <Dropdown
                        id="task-deadline-preset-btn"
                        label="Deadline preset"
                        icon={<ClockIcon size="sm" />}
                        buttonContent={
                            <>
                                <span className="whitespace-nowrap">
                                    {isUsingCustomDeadlineDefault
                                            ? formatDeadlineOffsetLabel(settings.timer.deadlineDefaults.offsetSec)
                                            : visibleDeadlinePresets.find((p) => p.id === safeDeadlinePresetId)?.label ?? 'Preset'}
                                </span>
                                <ChevronDownIcon size="sm" />
                            </>
                        }
                        options={deadlinePresetOptions}
                        selectedId={isUsingCustomDeadlineDefault ? CUSTOM_DEADLINE_PRESET_ID : safeDeadlinePresetId}
                        isOpen={presetOpen}
                        onToggle={() => setPresetOpen((s) => !s)}
                        onSelect={handleDeadlinePresetSelect}
                        onClose={() => setPresetOpen(false)}
                        title="Deadline preset"
                        ariaLabel="Deadline preset options"
                    />
                )}

                <div className="flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setShowDetails((s) => !s)}
                        className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-expanded={showDetails}
                        aria-controls="task-composer-details"
                        title="Show details"
                    >
                        + Details
                    </button>
                </div>

                <div className="flex-shrink-0">
                    <button
                        type="submit"
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Add task"
                        title="Add task"
                    >
                        <PlusIcon size="sm" />
                        Add
                    </button>
                </div>
            </div>

            {showDetails && (
                <DetailsPanel
                    timerMode={timerMode}
                    priority={priority}
                    note={note}
                    durationSec={durationSec}
                    durationUnit={durationUnit}
                    deadlineDate={deadlineDate}
                    pomoCycles={pomoCycles}
                    pomoWorkMin={pomoWorkMin}
                    pomoShortBreakMin={pomoShortBreakMin}
                    pomoLongBreakMin={pomoLongBreakMin}
                    autoEnabled={autoEnabled}
                    playEnabled={playEnabled}
                    autoResetEnabled={autoResetEnabled}
                    overdueEnabled={overdueEnabled}
                    presetLabel={presetLabel}
                    onTimerModeChange={onModeSelect}
                    onPriorityChange={setPriority}
                    onNoteChange={setNote}
                    onDurationSecChange={handleDurationSecChange}
                    onDurationUnitChange={handleDurationUnitChange}
                    onDeadlineDateChange={setDeadlineDate}
                    onPomoCyclesChange={setPomoCycles}
                    onPomoWorkMinChange={setPomoWorkMin}
                    onPomoShortBreakMinChange={setPomoShortBreakMin}
                    onPomoLongBreakMinChange={setPomoLongBreakMin}
                    onAutoEnabledChange={setAutoEnabled}
                    onPlayEnabledChange={setPlayEnabled}
                    onAutoResetEnabledChange={handleAutoResetChange}
                    onOverdueEnabledChange={handleOverdueChange}
                />
            )}
        </form>
    );
});