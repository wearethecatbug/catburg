'use client';

import React, { useState, forwardRef, useRef } from 'react';
import { useTasks } from '@/store';
import type { WorkspaceType, CreateTaskInput } from '@/domain/task.types';
import {
    PlusIcon,
    ClockIcon,
    ChevronDownIcon,

} from '@/shared';
import { Dropdown, DetailsPanel, type DropdownOption } from './components';

/**
 * Composer UI layout:
 * [ Title ] [ Mode ▾ (icon) ] [ Preset ▾ (with clock icon) ] [ + Details ] [ Add ]
 *
 * Enter submits. + Details раскрывает дополнительные поля (mode/duration).
 *
 * Changes:
 * - Added 'pomodoro' timerMode
 * - Added mode selector button (with chevron)
 * - PRESETS now include 25m and default is 25m
 * - Details panel reflects the selected mode
 */

interface AddTaskInputProps {
    defaultWorkspace?: WorkspaceType;
}

const PRESETS = [
    { id: '5', label: '5m', durationSec: 5 * 60 },
    { id: '10', label: '10m', durationSec: 10 * 60 },
    { id: '25', label: '25m', durationSec: 25 * 60 }, // default: 25m (pomodoro-friendly)
    { id: '45', label: '45m', durationSec: 45 * 60 },
    { id: '60', label: '1h', durationSec: 60 * 60 },
];

// Deadline presets: quick dates from now
const DEADLINE_PRESETS = [
    { id: '1d', label: '1 day', days: 1 },
    { id: '2d', label: '2 days', days: 2 },
    { id: '5d', label: '5 days', days: 5 },
    { id: '10d', label: '10 days', days: 10 },
];

// Pomodoro presets: cycles, work time, short break, long break
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
    const [durationMin, setDurationMin] = useState(PRESETS[2].durationSec / 60);
    const [timerMode, setTimerMode] = useState<TimerMode>('duration');
    const [deadlineDate, setDeadlineDate] = useState('');

    // Pomodoro-specific settings
    const [pomoCycles, setPomoCycles] = useState(4);
    const [pomoWorkMin, setPomoWorkMin] = useState(25);
    const [pomoShortBreakMin, setPomoShortBreakMin] = useState(5);
    const [pomoLongBreakMin, setPomoLongBreakMin] = useState(15);

    // Control toggles
    const [autoEnabled, setAutoEnabled] = useState(false);
    const [playEnabled, setPlayEnabled] = useState(true);
    const [autoResetEnabled, setAutoResetEnabled] = useState(false);
    const [overdueEnabled, setOverdueEnabled] = useState(false);

    const { addTask, state } = useTasks();
    const localInputRef = useRef<HTMLInputElement | null>(null);

    // Dropdown states
    const [presetOpen, setPresetOpen] = useState(false);
    const [modeOpen, setModeOpen] = useState(false);

    // setRef supports both function and object refs
    const setRef = (el: HTMLInputElement | null) => {
        localInputRef.current = el;
        if (!ref) return;
        if (typeof ref === 'function') {
            ref(el);
        } else {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
        }
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const title = value.trim();
        if (!title) return;

        // For deadline mode: use targetAt (ISO date string), no durationSec
        // For duration and pomodoro: use durationSec, no targetAt
        const durationSec = timerMode === 'deadline' ? undefined : Math.max(1, Math.floor(Number(durationMin))) * 60;

        // Convert local datetime-local to UTC ISO string for correct server parsing
        let targetAt: string | undefined = undefined;
        if (timerMode === 'deadline' && deadlineDate) {
            // deadlineDate is in format "2026-03-01T00:02" (local time from datetime-local input)
            // Parse it as local time and convert to UTC ISO string
            const localDate = new Date(deadlineDate + ':00'); // add seconds
            targetAt = localDate.toISOString();
        }

        const taskData: CreateTaskInput = {
            title,
            workspace: defaultWorkspace ?? state.workspace,
            timerMode,
            durationSec,
            targetAt,
            timerControls: {
                autoStart: autoEnabled,
                autoPlay: playEnabled,
                autoReset: autoResetEnabled,
                allowOverdue: overdueEnabled,
            },
        };

        // Add pomodoro-specific settings if mode is pomodoro
        if (timerMode === 'pomodoro') {
            const pomPreset = POMODORO_PRESETS.find((p) => p.id === pomodoroPresetId) ?? POMODORO_PRESETS[0];
            taskData.pomodoro = {
                cycles: pomPreset.cycles,
                workDurationMin: pomPreset.workDurationMin,
                shortBreakMin: pomPreset.shortBreakMin,
                longBreakMin: pomPreset.longBreakMin,
                autoStart: autoEnabled,
                autoPlay: playEnabled,
            };
        }

        addTask(taskData);

        // reset input, keep selected preset and mode
        setValue('');
        // reset duration input to preset value
        const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2];
        setDurationMin(preset.durationSec / 60);
        // reset deadline date
        setDeadlineDate('');
        
        // reset timer control toggles to default values
        setAutoEnabled(false);
        setPlayEnabled(true);
        setAutoResetEnabled(false);
        setOverdueEnabled(false);

        // focus input again
        try {
            localInputRef.current?.focus();
        } catch {}
    };

    // when preset changes — update durationMin
    const onPresetSelect = (id: string) => {
        setPresetId(id);
        const p = PRESETS.find((x) => x.id === id);
        if (p) setDurationMin(p.durationSec / 60);
        setPresetOpen(false);
        // keep focus on input for quick typing
        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    // Handle mode selection
    const onModeSelect = (mode: TimerMode) => {
        setTimerMode(mode);
        setModeOpen(false);

        // Apply presets based on mode
        if (mode === 'pomodoro') {
            const pomPreset = POMODORO_PRESETS.find((p) => p.id === pomodoroPresetId) ?? POMODORO_PRESETS[0];
            setPomoCycles(pomPreset.cycles);
            setPomoWorkMin(pomPreset.workDurationMin);
            setPomoShortBreakMin(pomPreset.shortBreakMin);
            setPomoLongBreakMin(pomPreset.longBreakMin);
        } else if (mode === 'deadline') {
            const dlPreset = DEADLINE_PRESETS.find((p) => p.id === deadlinePresetId) ?? DEADLINE_PRESETS[0];
            const now = new Date();
            now.setDate(now.getDate() + dlPreset.days);
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            setDeadlineDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        } else if (mode === 'duration') {
            const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2];
            setDurationMin(preset.durationSec / 60);
        }

        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    // Prepare dropdown options
    const modeOptions: DropdownOption[] = [
        { id: 'duration', label: 'Duration', icon: <HourglassIcon size="sm" /> },
        { id: 'pomodoro', label: 'Pomodoro', icon: <PomodoroIcon size="sm" /> },
        { id: 'deadline', label: 'Deadline', icon: <CalendarIcon size="sm" /> },
    ];

    const presetOptions: DropdownOption[] = PRESETS.map((p) => ({ id: p.id, label: p.label }));
    const pomodoroPresetOptions: DropdownOption[] = POMODORO_PRESETS.map((p) => ({ id: p.id, label: p.label }));
    const deadlinePresetOptions: DropdownOption[] = DEADLINE_PRESETS.map((p) => ({ id: p.id, label: p.label }));


    // Choose icon for current mode
    const ModeIcon = timerMode === 'duration' ? HourglassIcon : timerMode === 'deadline' ? CalendarIcon : PomodoroIcon;
    const modeLabel = timerMode === 'duration' ? 'Duration' : timerMode === 'deadline' ? 'Deadline' : 'Pomodoro';

    // Prepare current preset label and options based on mode
    const currentPresetLabel =
        timerMode === 'pomodoro'
            ? POMODORO_PRESETS.find((p) => p.id === pomodoroPresetId)?.label ?? 'Preset'
            : PRESETS.find((p) => p.id === presetId)?.label ?? 'Preset';

    const currentPresetOptions = timerMode === 'pomodoro' ? pomodoroPresetOptions : presetOptions;
    const currentPresetId = timerMode === 'pomodoro' ? pomodoroPresetId : presetId;

    // Handlers for preset selection
    const handlePresetSelect = (id: string) => {
        if (timerMode === 'pomodoro') {
            const p = POMODORO_PRESETS.find((x) => x.id === id);
            if (p) {
                setPomodoroPresetId(id);
                setPomoCycles(p.cycles);
                setPomoWorkMin(p.workDurationMin);
                setPomoShortBreakMin(p.shortBreakMin);
                setPomoLongBreakMin(p.longBreakMin);
            }
        } else {
            onPresetSelect(id);
        }
    };

    const handleDeadlinePresetSelect = (id: string) => {
        setDeadlinePresetId(id);
        const p = DEADLINE_PRESETS.find((x) => x.id === id);
        if (p) {
            const now = new Date();
            now.setDate(now.getDate() + p.days);
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            setDeadlineDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
        requestAnimationFrame(() => localInputRef.current?.focus());
    };

    // Handle Auto Reset toggle - disable Allow Overdue when enabled
    const handleAutoResetChange = (enabled: boolean) => {
        setAutoResetEnabled(enabled);
        // If enabling Auto Reset, disable Allow Overdue
        if (enabled && overdueEnabled) {
            setOverdueEnabled(false);
        }
    };

    // Handle Allow Overdue toggle - disable Auto Reset when enabled
    const handleOverdueChange = (enabled: boolean) => {
        setOverdueEnabled(enabled);
        // If enabling Allow Overdue, disable Auto Reset
        if (enabled && autoResetEnabled) {
            setAutoResetEnabled(false);
        }
    };

    return (
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-2">
            <div className="flex items-center gap-2">
                {/* Title input */}
                <div className="flex-1 relative">
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
                        className="w-full pl-3 pr-3 py-2.5 text-gray-700 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        aria-label="Add a new task"
                    />
                </div>

                {/* Mode dropdown */}
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

                {/* Preset dropdown - HIDDEN for deadline mode */}
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

                {/* Deadline Preset Button - shows ONLY in deadline mode */}
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

                {/* Details toggle */}
                <div className="flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setShowDetails((s) => !s)}
                        className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-expanded={showDetails}
                        aria-controls="task-composer-details"
                        title="Show details"
                    >
                        + Details
                    </button>
                </div>

                {/* Add button */}
                <div className="flex-shrink-0">
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Add task"
                        title="Add task"
                    >
                        <PlusIcon size="sm" />
                        Add
                    </button>
                </div>
            </div>

            {/* Details panel */}
            {showDetails && (
                <DetailsPanel
                    timerMode={timerMode}
                    durationMin={durationMin}
                    deadlineDate={deadlineDate}
                    pomoCycles={pomoCycles}
                    pomoWorkMin={pomoWorkMin}
                    pomoShortBreakMin={pomoShortBreakMin}
                    pomoLongBreakMin={pomoLongBreakMin}
                    autoEnabled={autoEnabled}
                    playEnabled={playEnabled}
                    autoResetEnabled={autoResetEnabled}
                    overdueEnabled={overdueEnabled}
                    presetLabel={PRESETS.find((p) => p.id === presetId)?.label}
                    onTimerModeChange={setTimerMode}
                    onDurationMinChange={setDurationMin}
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


