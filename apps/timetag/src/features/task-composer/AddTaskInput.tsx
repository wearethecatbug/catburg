'use client';

import React, { useState, forwardRef, useRef } from 'react';
import { useTasks } from '@/store';
import type { WorkspaceType, CreateTaskInput, TaskPriority } from '@/domain/task.types';
import type { DurationUnit } from '@/domain/duration';
import {
    PlusIcon,
    ClockIcon,
    ChevronDownIcon,
    HourglassIcon,
    CalendarIcon,
    PomodoroIcon,
} from '@/shared';
import { Dropdown, DetailsPanel, type DropdownOption } from './components';

interface AddTaskInputProps {
    defaultWorkspace?: WorkspaceType;
}

const PRESETS = [
    { id: '5', label: '5m', durationSec: 5 * 60 },
    { id: '10', label: '10m', durationSec: 10 * 60 },
    { id: '25', label: '25m', durationSec: 25 * 60 },
    { id: '45', label: '45m', durationSec: 45 * 60 },
    { id: '60', label: '1h', durationSec: 60 * 60 },
];

const DEADLINE_PRESETS = [
    { id: '1d', label: '1 day', days: 1 },
    { id: '2d', label: '2 days', days: 2 },
    { id: '5d', label: '5 days', days: 5 },
    { id: '10d', label: '10 days', days: 10 },
];

const POMODORO_PRESETS = [
    {
        id: 'classic',
        label: 'Classic (1×25m)',
        cycles: 1,
        workDurationMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
    },
    {
        id: 'focus',
        label: 'Focus (2×25m)',
        cycles: 2,
        workDurationMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
    },
    {
        id: 'extended',
        label: 'Extended (4×25m)',
        cycles: 4,
        workDurationMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
    },
    {
        id: 'quick',
        label: 'Quick (3×15m)',
        cycles: 3,
        workDurationMin: 15,
        shortBreakMin: 3,
        longBreakMin: 10,
    },
];

type TimerMode = 'duration' | 'deadline' | 'pomodoro';

export const AddTaskInput = forwardRef<HTMLInputElement, AddTaskInputProps>(function AddTaskInput(
    { defaultWorkspace },
    ref,
) {
    const [value, setValue] = useState('');
    const [presetId, setPresetId] = useState(PRESETS[2].id);
    const [pomodoroPresetId, setPomodoroPresetId] = useState(POMODORO_PRESETS[0].id);
    const [deadlinePresetId, setDeadlinePresetId] = useState(DEADLINE_PRESETS[0].id);
    const [showDetails, setShowDetails] = useState(false);

    const [timerMode, setTimerMode] = useState<TimerMode>('duration');
    const [priority, setPriority] = useState<TaskPriority>('normal');
    const [deadlineDate, setDeadlineDate] = useState('');

    const [durationSec, setDurationSec] = useState(25 * 60);
    const [durationUnit, setDurationUnit] = useState<DurationUnit>('min');
    const [presetLabel, setPresetLabel] = useState<string | undefined>('25m');

    const [pomoCycles, setPomoCycles] = useState(4);
    const [pomoWorkMin, setPomoWorkMin] = useState(25);
    const [pomoShortBreakMin, setPomoShortBreakMin] = useState(5);
    const [pomoLongBreakMin, setPomoLongBreakMin] = useState(15);

    const [autoEnabled, setAutoEnabled] = useState(false);
    const [playEnabled, setPlayEnabled] = useState(true);
    const [autoResetEnabled, setAutoResetEnabled] = useState(false);
    const [overdueEnabled, setOverdueEnabled] = useState(false);

    const { addTask, state } = useTasks();
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

    const getDurationUnitFromSec = (valueSec: number): DurationUnit => {
        if (valueSec % 86400 === 0) return 'd';
        if (valueSec % 3600 === 0) return 'h';
        return 'min';
    };

    const applyDurationPreset = (preset: (typeof PRESETS)[number]) => {
        setDurationSec(preset.durationSec);
        setDurationUnit(getDurationUnitFromSec(preset.durationSec));
        setPresetLabel(preset.label);
    };

    const buildDeadlineLocalValue = (daysFromNow: number) => {
        const now = new Date();
        now.setDate(now.getDate() + daysFromNow);

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
            workspace: defaultWorkspace ?? state.workspace,
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
        setPriority('normal');

        const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2];
        applyDurationPreset(preset);

        setDeadlineDate('');
        setAutoEnabled(false);
        setPlayEnabled(true);
        setAutoResetEnabled(false);
        setOverdueEnabled(false);

        try {
            localInputRef.current?.focus();
        } catch {}
    };

    const onPresetSelect = (id: string) => {
        setPresetId(id);

        const preset = PRESETS.find((x) => x.id === id);
        if (preset) {
            applyDurationPreset(preset);
        }

        setPresetOpen(false);
        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    const onModeSelect = (mode: TimerMode) => {
        setTimerMode(mode);
        setModeOpen(false);

        if (mode === 'pomodoro') {
            const pomPreset = POMODORO_PRESETS.find((p) => p.id === pomodoroPresetId) ?? POMODORO_PRESETS[0];
            setPomoCycles(pomPreset.cycles);
            setPomoWorkMin(pomPreset.workDurationMin);
            setPomoShortBreakMin(pomPreset.shortBreakMin);
            setPomoLongBreakMin(pomPreset.longBreakMin);
        } else if (mode === 'deadline') {
            const dlPreset = DEADLINE_PRESETS.find((p) => p.id === deadlinePresetId) ?? DEADLINE_PRESETS[0];
            setDeadlineDate(buildDeadlineLocalValue(dlPreset.days));
        } else {
            const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2];
            applyDurationPreset(preset);
        }

        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    const modeOptions: DropdownOption[] = [
        { id: 'duration', label: 'Duration', icon: <HourglassIcon size="sm" /> },
        { id: 'pomodoro', label: 'Pomodoro', icon: <PomodoroIcon size="sm" /> },
        { id: 'deadline', label: 'Deadline', icon: <CalendarIcon size="sm" /> },
    ];

    const presetOptions: DropdownOption[] = PRESETS.map((p) => ({ id: p.id, label: p.label }));
    const pomodoroPresetOptions: DropdownOption[] = POMODORO_PRESETS.map((p) => ({ id: p.id, label: p.label }));
    const deadlinePresetOptions: DropdownOption[] = DEADLINE_PRESETS.map((p) => ({ id: p.id, label: p.label }));

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

    const currentPresetLabel =
        timerMode === 'pomodoro'
            ? POMODORO_PRESETS.find((p) => p.id === pomodoroPresetId)?.label ?? 'Preset'
            : PRESETS.find((p) => p.id === presetId)?.label ?? 'Preset';

    const currentPresetOptions = timerMode === 'pomodoro' ? pomodoroPresetOptions : presetOptions;
    const currentPresetId = timerMode === 'pomodoro' ? pomodoroPresetId : presetId;

    const handlePresetSelect = (id: string) => {
        if (timerMode === 'pomodoro') {
            const preset = POMODORO_PRESETS.find((x) => x.id === id);
            if (preset) {
                setPomodoroPresetId(id);
                setPomoCycles(preset.cycles);
                setPomoWorkMin(preset.workDurationMin);
                setPomoShortBreakMin(preset.shortBreakMin);
                setPomoLongBreakMin(preset.longBreakMin);
            }

            setPresetOpen(false);
            requestAnimationFrame(() => localInputRef.current?.focus());
            return;
        }

        onPresetSelect(id);
    };

    const handleDeadlinePresetSelect = (id: string) => {
        setDeadlinePresetId(id);

        const preset = DEADLINE_PRESETS.find((x) => x.id === id);
        if (preset) {
            setDeadlineDate(buildDeadlineLocalValue(preset.days));
        }

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
        setPresetLabel(undefined);
    };

    const handleDurationUnitChange = (unit: DurationUnit) => {
        setDurationUnit(unit);

        const matchingPreset = PRESETS.find((p) => p.durationSec === durationSec);
        if (matchingPreset && getDurationUnitFromSec(durationSec) === unit) {
            // ✅ Switching to the canonical unit for this preset → restore the preset label
            setPresetLabel(matchingPreset.label);
        } else {
            // ✅ Switching to a non-canonical unit → clear the label to avoid contradictions
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
                                    {DEADLINE_PRESETS.find((p) => p.id === deadlinePresetId)?.label ?? 'Preset'}
                                </span>
                                <ChevronDownIcon size="sm" />
                            </>
                        }
                        options={deadlinePresetOptions}
                        selectedId={deadlinePresetId}
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