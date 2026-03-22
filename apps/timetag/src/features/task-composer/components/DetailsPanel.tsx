'use client';

import React from 'react';
import { TASK_NOTE_MAX_LENGTH, type TaskPriority, type TimerMode } from '@/domain/task.types';
import type { DurationUnit } from '@/domain/duration';
import { ModeSelector } from './ModeSelector';
import { PrioritySelect } from './PrioritySelect';
import { PomodoroSettings } from './PomodoroSettings';
import { TimerControlsSection } from './TimerControlsSection';
import { DurationField } from './DurationField';

interface DetailsPanelProps {
    timerMode: TimerMode;
    priority: TaskPriority;
    note: string;

    durationSec: number;
    durationUnit: DurationUnit;

    deadlineDate: string;
    pomoCycles: number;
    pomoWorkMin: number;
    pomoShortBreakMin: number;
    pomoLongBreakMin: number;
    autoEnabled: boolean;
    playEnabled: boolean;
    autoResetEnabled: boolean;
    overdueEnabled: boolean;
    presetLabel?: string;

    onTimerModeChange: (mode: TimerMode) => void;
    onPriorityChange: (priority: TaskPriority) => void;
    onNoteChange: (value: string) => void;

    onDurationSecChange: (value: number) => void;
    onDurationUnitChange: (unit: DurationUnit) => void;

    onDeadlineDateChange: (value: string) => void;
    onPomoCyclesChange: (value: number) => void;
    onPomoWorkMinChange: (value: number) => void;
    onPomoShortBreakMinChange: (value: number) => void;
    onPomoLongBreakMinChange: (value: number) => void;
    onAutoEnabledChange: (value: boolean) => void;
    onPlayEnabledChange: (value: boolean) => void;
    onAutoResetEnabledChange: (value: boolean) => void;
    onOverdueEnabledChange: (value: boolean) => void;
}

export function DetailsPanel({
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
                                 onTimerModeChange,
                                 onPriorityChange,
                                  onNoteChange,
                                 onDurationSecChange,
                                 onDurationUnitChange,
                                 onDeadlineDateChange,
                                 onPomoCyclesChange,
                                 onPomoWorkMinChange,
                                 onPomoShortBreakMinChange,
                                 onPomoLongBreakMinChange,
                                 onAutoEnabledChange,
                                 onPlayEnabledChange,
                                 onAutoResetEnabledChange,
                                 onOverdueEnabledChange,
                             }: DetailsPanelProps) {
    return (
        <div
            id="task-composer-details"
            className="space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3"
        >
            <ModeSelector timerMode={timerMode} onChange={onTimerModeChange} />

            {timerMode === 'pomodoro' ? (
                <PomodoroSettings
                    cycles={pomoCycles}
                    workMin={pomoWorkMin}
                    shortBreakMin={pomoShortBreakMin}
                    longBreakMin={pomoLongBreakMin}
                    onCyclesChange={onPomoCyclesChange}
                    onWorkMinChange={onPomoWorkMinChange}
                    onShortBreakMinChange={onPomoShortBreakMinChange}
                    onLongBreakMinChange={onPomoLongBreakMinChange}
                />
            ) : timerMode === 'deadline' ? (
                <div className="flex flex-col">
                    <label htmlFor="deadline-picker" className="mb-1 text-xs font-medium text-gray-700">
                        Deadline
                    </label>
                    <input
                        id="deadline-picker"
                        type="datetime-local"
                        value={deadlineDate}
                        onChange={(e) => onDeadlineDateChange(e.target.value)}
                        className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Deadline date and time"
                    />
                    <div className="mt-1 text-xs text-gray-500">
                        Set specific date and time for this task
                    </div>
                </div>
            ) : (
                <DurationField
                    durationSec={durationSec}
                    unit={durationUnit}
                    presetLabel={presetLabel}
                    onDurationSecChange={onDurationSecChange}
                    onUnitChange={onDurationUnitChange}
                />
            )}

            <PrioritySelect priority={priority} onChange={onPriorityChange} />

            <div className="flex flex-col">
                <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor="task-note" className="text-xs font-medium text-gray-700">
                        Note
                    </label>
                    <span className="text-[11px] text-gray-500" aria-live="polite">
                        {note.length}/{TASK_NOTE_MAX_LENGTH}
                    </span>
                </div>
                <textarea
                    id="task-note"
                    value={note}
                    onChange={(e) => onNoteChange(e.target.value.slice(0, TASK_NOTE_MAX_LENGTH))}
                    rows={3}
                    maxLength={TASK_NOTE_MAX_LENGTH}
                    placeholder="Add a short note…"
                    className="resize-none rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-describedby="task-note-help"
                />
                <div id="task-note-help" className="mt-1 text-xs text-gray-500">
                    Optional note for context, reminders, or next steps.
                </div>
            </div>

            <TimerControlsSection
                timerMode={timerMode}
                autoEnabled={autoEnabled}
                playEnabled={playEnabled}
                autoResetEnabled={autoResetEnabled}
                overdueEnabled={overdueEnabled}
                onAutoEnabledChange={onAutoEnabledChange}
                onPlayEnabledChange={onPlayEnabledChange}
                onAutoResetEnabledChange={onAutoResetEnabledChange}
                onOverdueEnabledChange={onOverdueEnabledChange}
            />
        </div>
    );
}