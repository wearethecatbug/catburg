'use client';

import React from 'react';
import { TASK_NOTE_MAX_LENGTH, type TaskPriority, type TimerMode } from '@/domain/task.types';
import type { DurationUnit } from '@/domain/duration';
import { CheckIcon, ChevronDownIcon, ClipboardIcon } from '@/shared';
import type { DropdownOption } from './Dropdown';
import { Dropdown } from './Dropdown';
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
    workspaceOpen: boolean;
    showWorkspaceDropdown: boolean;
    showWorkspaceEmptyState: boolean;
    workspaceHelperText: string;
    workspaceOptions: DropdownOption[];
    selectedWorkspaceOptionId: string;
    selectedWorkspaceLabel: string;

    onTimerModeChange: (mode: TimerMode) => void;
    onWorkspaceOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
    onWorkspaceSelect: (id: string) => void;
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
    onCancel: () => void;
    onReset: () => void;
    canSubmit: boolean;
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
    workspaceOpen,
    showWorkspaceDropdown,
    showWorkspaceEmptyState,
    workspaceHelperText,
    workspaceOptions,
    selectedWorkspaceOptionId,
    selectedWorkspaceLabel,
    onTimerModeChange,
    onWorkspaceOpenChange,
    onWorkspaceSelect,
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
    onCancel,
    onReset,
    canSubmit,
}: DetailsPanelProps) {
    const fieldStyle: React.CSSProperties = {
        borderColor: 'var(--tt-border)',
        background: 'var(--tt-input-bg)',
        color: 'var(--tt-text)',
    };
    const workspaceFadeStyle: React.CSSProperties = {
        background: 'linear-gradient(90deg, transparent 0%, var(--tt-input-bg) 72%)',
    };

    return (
        <div
            id="task-composer-details"
            className="space-y-4 border-t px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4"
            style={{
                borderColor: 'var(--tt-border)',
                background: 'linear-gradient(180deg, var(--tt-surface) 0%, var(--tt-surface-subtle) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(15, 23, 42, 0.03)',
            }}
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
                    <label htmlFor="deadline-picker" className="mb-1 text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                        Deadline
                    </label>
                    <input
                        id="deadline-picker"
                        type="datetime-local"
                        value={deadlineDate}
                        onChange={(e) => onDeadlineDateChange(e.target.value)}
                        className="rounded-xl border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]"
                        style={fieldStyle}
                        aria-label="Deadline date and time"
                    />
                    <div className="mt-1 text-xs" style={{ color: 'var(--tt-text-soft)' }}>
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
                <div className="mb-1 text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                    Workspace
                </div>

                <div className="w-full max-w-[18rem]">
                    {showWorkspaceDropdown ? (
                        <Dropdown
                            id="task-workspace-btn"
                            label="Workspace"
                            icon={<ClipboardIcon size="sm" />}
                            buttonContent={
                                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                    <span className="relative min-w-0 flex-1 text-left">
                                        <span className="block truncate pr-3">{selectedWorkspaceLabel}</span>
                                        <span
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-y-0 right-0 w-8"
                                            style={workspaceFadeStyle}
                                        />
                                    </span>
                                    <ChevronDownIcon size="sm" />
                                </span>
                            }
                            options={workspaceOptions}
                            selectedId={selectedWorkspaceOptionId}
                            isOpen={workspaceOpen}
                            onToggle={() => onWorkspaceOpenChange((current) => !current)}
                            onSelect={onWorkspaceSelect}
                            onClose={() => onWorkspaceOpenChange(false)}
                            title="Workspace"
                            ariaLabel="Workspace options"
                            fullWidth
                            menuAlign="left"
                            menuWidth="trigger"
                        />
                    ) : (
                        <div
                            data-testid="task-workspace-state"
                            className={`rounded-xl border px-3 py-2 text-sm ${showWorkspaceEmptyState ? 'border-dashed' : ''}`}
                            style={fieldStyle}
                        >
                            <span className="relative block min-w-0">
                                <span className="block truncate pr-3">{selectedWorkspaceLabel}</span>
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 right-0 w-8"
                                    style={workspaceFadeStyle}
                                />
                            </span>
                        </div>
                    )}
                </div>

                <div className="mt-1 text-xs" style={{ color: 'var(--tt-text-soft)' }}>
                    {workspaceHelperText}
                </div>
            </div>

            <div className="flex flex-col">
                <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor="task-note" className="text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                        Note
                    </label>
                    <span className="text-[11px]" style={{ color: 'var(--tt-text-soft)' }} aria-live="polite">
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
                    className="resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]"
                    style={fieldStyle}
                    aria-describedby="task-note-help"
                />
                <div id="task-note-help" className="mt-1 text-xs" style={{ color: 'var(--tt-text-soft)' }}>
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

            <div
                className="flex flex-wrap items-center justify-end gap-2 border-t pt-3"
                style={{ borderColor: 'rgba(15, 23, 42, 0.05)' }}
            >
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--tt-surface-hover)]"
                    style={{
                        borderColor: 'var(--tt-border)',
                        background: 'var(--tt-surface)',
                        color: 'var(--tt-text-muted)',
                    }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onReset}
                    className="rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--tt-surface-hover)]"
                    style={{
                        borderColor: 'var(--tt-border)',
                        background: 'var(--tt-surface-muted)',
                        color: 'var(--tt-text)',
                    }}
                >
                    Reset
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-transform duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                        background: 'linear-gradient(180deg, #5b8cff 0%, var(--tt-accent) 100%)',
                        color: 'var(--tt-accent-contrast)',
                        boxShadow: '0 6px 16px rgba(79, 125, 243, 0.25)',
                    }}
                >
                    <CheckIcon size="sm" />
                    Save
                </button>
            </div>
        </div>
    );
}