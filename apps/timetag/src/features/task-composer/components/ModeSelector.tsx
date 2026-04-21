import React from 'react';
import { HourglassIcon, CalendarIcon, NoteIcon, PomodoroIcon } from '@/shared/icons';
import type { TimerMode } from '@/domain/task.types';

interface ModeSelectorProps {
    timerMode: TimerMode;
    onChange: (mode: TimerMode) => void;
}

export function ModeSelector({ timerMode, onChange }: ModeSelectorProps) {
    const modes: Array<{ value: TimerMode; label: string; Icon: typeof HourglassIcon }> = [
        { value: 'duration', label: 'Duration', Icon: HourglassIcon },
        { value: 'pomodoro', label: 'Pomodoro', Icon: PomodoroIcon },
        { value: 'deadline', label: 'Deadline', Icon: CalendarIcon },
        { value: 'note', label: 'Note', Icon: NoteIcon },
    ];

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>Mode</legend>
            <div
                className="inline-flex w-fit flex-wrap gap-2 rounded-xl border p-1"
                style={{
                    borderColor: 'var(--tt-border)',
                    background: 'var(--tt-surface-muted)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                }}
            >
                {modes.map(({ value, label, Icon }) => (
                    <label
                        key={value}
                        className="cursor-pointer rounded-lg"
                    >
                        <input
                            type="radio"
                            name="timerMode"
                            checked={timerMode === value}
                            onChange={() => onChange(value)}
                            className="sr-only"
                        />
                        <span
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--tt-surface-hover)]"
                            style={timerMode === value
                                ? {
                                    background: 'var(--tt-chip-active-bg)',
                                    color: 'var(--tt-chip-active-text)',
                                  }
                                : {
                                    color: 'var(--tt-text-muted)',
                                  }}
                        >
                            <Icon size="sm" />
                            {label}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}


