import React from 'react';
import { NumberInput } from './NumberInput';

interface PomodoroSettingsProps {
    cycles: number;
    workMin: number;
    shortBreakMin: number;
    longBreakMin: number;
    onCyclesChange: (value: number) => void;
    onWorkMinChange: (value: number) => void;
    onShortBreakMinChange: (value: number) => void;
    onLongBreakMinChange: (value: number) => void;
}

export function PomodoroSettings({
    cycles,
    workMin,
    shortBreakMin,
    longBreakMin,
    onCyclesChange,
    onWorkMinChange,
    onShortBreakMinChange,
    onLongBreakMinChange,
}: PomodoroSettingsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumberInput
                id="pomo-cycles"
                label="Cycles"
                value={cycles}
                onChange={onCyclesChange}
                min={1}
                max={10}
                unit="cycles"
                ariaLabel="Number of Pomodoro cycles"
            />
            <NumberInput
                id="pomo-work"
                label="Work"
                value={workMin}
                onChange={onWorkMinChange}
                min={1}
                max={60}
                unit="min"
                ariaLabel="Work duration in minutes"
            />
            <NumberInput
                id="pomo-short-break"
                label="Short Break"
                value={shortBreakMin}
                onChange={onShortBreakMinChange}
                min={1}
                max={30}
                unit="min"
                ariaLabel="Short break duration in minutes"
            />
            <NumberInput
                id="pomo-long-break"
                label="Long Break"
                value={longBreakMin}
                onChange={onLongBreakMinChange}
                min={1}
                max={60}
                unit="min"
                ariaLabel="Long break duration in minutes"
            />
        </div>
    );
}

