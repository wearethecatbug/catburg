import React from 'react';
import { HourglassIcon, CalendarIcon, PomodoroIcon } from '@/shared/icons';

type TimerMode = 'duration' | 'deadline' | 'pomodoro';

interface ModeSelectorProps {
    timerMode: TimerMode;
    onChange: (mode: TimerMode) => void;
}

export function ModeSelector({ timerMode, onChange }: ModeSelectorProps) {
    const modes: Array<{ value: TimerMode; label: string; Icon: typeof HourglassIcon }> = [
        { value: 'duration', label: 'Duration', Icon: HourglassIcon },
        { value: 'pomodoro', label: 'Pomodoro', Icon: PomodoroIcon },
        { value: 'deadline', label: 'Deadline', Icon: CalendarIcon },
    ];

    return (
        <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-2">Mode</label>
            <div className="flex gap-2">
                {modes.map(({ value, label, Icon }) => (
                    <label
                        key={value}
                        className={`px-2 py-1 text-sm border rounded cursor-pointer ${
                            timerMode === value ? 'bg-white border-blue-500' : 'bg-white border-gray-300'
                        }`}
                    >
                        <input
                            type="radio"
                            name="timerMode"
                            checked={timerMode === value}
                            onChange={() => onChange(value)}
                            className="sr-only"
                        />
                        <span className="text-gray-700 inline-flex items-center gap-2">
                            <Icon size="sm" /> {label}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}


