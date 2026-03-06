import React from 'react';
import { ModeSelector } from './ModeSelector';
import { PomodoroSettings } from './PomodoroSettings';
import { TimerControlsSection } from './TimerControlsSection';

type TimerMode = 'duration' | 'deadline' | 'pomodoro';

interface DetailsPanelProps {
    timerMode: TimerMode;
    durationMin: number;
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
    onDurationMinChange: (value: number) => void;
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
    durationMin,
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
    onDurationMinChange,
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
        <div id="task-composer-details" className="p-3 border border-gray-100 rounded-md bg-gray-50 space-y-3">
            {/* Mode */}
            <ModeSelector timerMode={timerMode} onChange={onTimerModeChange} />

            {/* Duration or Pomodoro Settings */}
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
                /* Deadline Settings - only datetime picker */
                <div className="flex flex-col">
                    <label htmlFor="deadline-picker" className="text-xs font-medium text-gray-700 mb-1">
                        Deadline
                    </label>
                    <input
                        id="deadline-picker"
                        type="datetime-local"
                        value={deadlineDate}
                        onChange={(e) => onDeadlineDateChange(e.target.value)}
                        className="py-2 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                        aria-label="Deadline date and time"
                    />
                    <div className="text-xs text-gray-500 mt-1">Set specific date and time for this task</div>
                </div>
            ) : (
                /* Duration Settings - only for duration mode */
                <div className="flex flex-col">
                    <label htmlFor="duration-min" className="text-xs font-medium text-gray-700 mb-1">
                        Duration (minutes)
                    </label>
                    <input
                        id="duration-min"
                        type="number"
                        min={1}
                        value={String(durationMin)}
                        onChange={(e) => onDurationMinChange(Math.max(1, Number(e.target.value || 1)))}
                        className="py-2 px-3 text-gray-700 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Duration in minutes"
                    />
                    {presetLabel && <div className="text-xs text-gray-500 mt-1">Preset: {presetLabel}</div>}
                </div>
            )}

            {/* Timer Controls */}
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

