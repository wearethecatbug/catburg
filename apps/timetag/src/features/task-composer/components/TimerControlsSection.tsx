import React from 'react';
import { TimerControlToggle } from './TimerControlToggle';

type TimerMode = 'duration' | 'deadline' | 'pomodoro';

interface TimerControlsSectionProps {
    timerMode: TimerMode;
    autoEnabled: boolean;
    playEnabled: boolean;
    autoResetEnabled: boolean;
    overdueEnabled: boolean;
    onAutoEnabledChange: (value: boolean) => void;
    onPlayEnabledChange: (value: boolean) => void;
    onAutoResetEnabledChange: (value: boolean) => void;
    onOverdueEnabledChange: (value: boolean) => void;
}

export function TimerControlsSection({
    timerMode,
    autoEnabled,
    playEnabled,
    autoResetEnabled,
    overdueEnabled,
    onAutoEnabledChange,
    onPlayEnabledChange,
    onAutoResetEnabledChange,
    onOverdueEnabledChange,
}: TimerControlsSectionProps) {
    return (
        <div className="pt-3 border-t border-gray-200">
            <label className="text-xs font-medium text-gray-700 mb-2 block">Timer Controls</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Auto Start toggle - ALL MODES */}
                <TimerControlToggle
                    checked={autoEnabled}
                    onChange={onAutoEnabledChange}
                    label="Auto Start"
                    description="Start timer immediately"
                    ariaLabel="Auto start timer when task is created"
                />

                {/* Notifications toggle - ALL MODES (depends on Auto Start) */}
                <TimerControlToggle
                    checked={playEnabled}
                    onChange={onPlayEnabledChange}
                    disabled={!autoEnabled}
                    label="Notifications"
                    description="Sound alerts for events"
                    ariaLabel="Sound alerts when timer events occur"
                />

                {/* Auto Reset toggle - ONLY FOR DURATION MODE */}
                {timerMode === 'duration' && (
                    <TimerControlToggle
                        checked={autoResetEnabled}
                        onChange={onAutoResetEnabledChange}
                        label="Auto Reset"
                        description="Reset when timer ends"
                        ariaLabel="Auto reset timer when it reaches zero"
                    />
                )}

                {/* Allow Overdue toggle - DURATION & DEADLINE MODES (NOT POMODORO) */}
                {timerMode !== 'pomodoro' && (
                    <TimerControlToggle
                        checked={overdueEnabled}
                        onChange={onOverdueEnabledChange}
                        label="Allow Overdue"
                        description="Continue counting past zero"
                        ariaLabel="Allow timer to go negative when overdue"
                    />
                )}
            </div>
        </div>
    );
}

