'use client';

import React from 'react';
import { type TaskPriority, type TimerMode } from '@/domain/task.types';
import { supportsTimer } from '@/domain/task.mode';
import type { DurationUnit } from '@/domain/duration';
import { ChevronDownIcon, ClipboardIcon } from '@/shared';
import { TASK_COMPOSER_TIMER_MODE_OPTIONS, getTaskComposerTimerModeLabel } from '../task-composer.timer-mode';
import type { DropdownOption } from './Dropdown';
import { Dropdown } from './Dropdown';
import { PrioritySelect } from './PrioritySelect';
import { PomodoroSettings } from './PomodoroSettings';
import { TimerControlsSection } from './TimerControlsSection';
import { DurationField } from './DurationField';

interface MorePanelProps {
    timerMode: TimerMode;
    priority: TaskPriority;
    canApply: boolean;
    timerModeOpen: boolean;

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

    onWorkspaceOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
    onTimerModeOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
    onWorkspaceSelect: (id: string) => void;
    onTimerModeChange: (mode: TimerMode) => void;
    onPriorityChange: (priority: TaskPriority) => void;

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
    onClose: () => void;
    onReset: () => void;
}

export function MorePanel({
    timerMode,
    priority,
    canApply,
    timerModeOpen,
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
    onWorkspaceOpenChange,
    onTimerModeOpenChange,
    onWorkspaceSelect,
    onTimerModeChange,
    onPriorityChange,
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
    onClose,
    onReset,
}: MorePanelProps) {
    const [hoveredAction, setHoveredAction] = React.useState<'cancel' | 'reset' | 'apply' | null>(null);
    const fieldStyle: React.CSSProperties = {
        borderColor: 'var(--tt-border)',
        background: 'var(--tt-input-bg)',
        color: 'var(--tt-text)',
    };
    const workspaceFadeStyle: React.CSSProperties = {
        background: 'linear-gradient(90deg, transparent 0%, var(--tt-input-bg) 72%)',
    };
    const actionHoverBorderColor = 'rgba(79, 125, 243, 0.28)';

    const cancelButtonStyle: React.CSSProperties = {
        borderColor: hoveredAction === 'cancel' ? actionHoverBorderColor : 'rgba(215, 222, 231, 0.78)',
        background: hoveredAction === 'cancel' ? 'rgba(79, 125, 243, 0.02)' : 'var(--tt-surface)',
        borderWidth: 1,
        color: hoveredAction === 'cancel' ? 'color-mix(in srgb, var(--tt-accent) 68%, var(--tt-text-muted))' : 'var(--tt-text-muted)',
        boxShadow: 'none',
        transform: 'none',
    };

    const resetButtonStyle: React.CSSProperties = {
        borderColor: hoveredAction === 'reset' ? actionHoverBorderColor : 'rgba(215, 222, 231, 0.78)',
        background: hoveredAction === 'reset' ? 'rgba(79, 125, 243, 0.025)' : 'var(--tt-surface-muted)',
        borderWidth: 1,
        color: hoveredAction === 'reset' ? 'color-mix(in srgb, var(--tt-accent) 64%, var(--tt-text))' : 'var(--tt-text)',
        boxShadow: 'none',
        transform: 'none',
    };

    const applyButtonStyle: React.CSSProperties = {
        background: hoveredAction === 'apply'
            ? 'color-mix(in srgb, var(--tt-accent) 86%, white)'
            : 'color-mix(in srgb, var(--tt-accent) 80%, white)',
        borderColor: hoveredAction === 'apply'
            ? 'color-mix(in srgb, var(--tt-accent) 78%, white)'
            : 'color-mix(in srgb, var(--tt-accent) 72%, white)',
        borderWidth: 1,
        color: 'color-mix(in srgb, var(--tt-accent-contrast) 92%, white)',
        boxShadow: 'none',
        transform: 'none',
    };

    return (
        <div
            id="task-composer-more"
            className="space-y-4 border-t px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4"
            style={{
                borderColor: 'var(--tt-border)',
                background: 'linear-gradient(180deg, var(--tt-surface) 0%, var(--tt-surface-subtle) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(15, 23, 42, 0.03)',
            }}
        >
            <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--tt-text)' }}>
                    More options
                </h3>
            </div>

            <div className="space-y-2">
                <div className="text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                    Timer mode
                </div>
                <div className="w-full max-w-[14rem]">
                    <Dropdown
                        id="task-more-mode-btn"
                        label="Timer mode"
                        icon={null}
                        buttonClassName="w-full justify-between"
                        buttonContent={
                            <span className="inline-flex min-w-0 flex-1 items-center justify-between gap-2">
                                <span className="whitespace-nowrap">{getTaskComposerTimerModeLabel(timerMode)}</span>
                                <ChevronDownIcon size="sm" />
                            </span>
                        }
                        options={TASK_COMPOSER_TIMER_MODE_OPTIONS}
                        selectedId={timerMode}
                        isOpen={timerModeOpen}
                        onToggle={() => onTimerModeOpenChange((current) => !current)}
                        onSelect={(id) => onTimerModeChange(id as TimerMode)}
                        onClose={() => onTimerModeOpenChange(false)}
                        title="Timer mode"
                        ariaLabel="Advanced timer mode options"
                        fullWidth
                        menuAlign="left"
                        menuWidth="trigger"
                    />
                </div>
            </div>

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
                    <label
                        htmlFor="deadline-picker"
                        className="mb-1 text-xs font-medium"
                        style={{ color: 'var(--tt-text-muted)' }}
                    >
                        Exact deadline
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
                        Use the preset for quick offsets, then fine-tune the exact timestamp here when needed.
                    </div>
                </div>
            ) : timerMode === 'duration' ? (
                <DurationField
                    durationSec={durationSec}
                    unit={durationUnit}
                    presetLabel={presetLabel}
                    onDurationSecChange={onDurationSecChange}
                    onUnitChange={onDurationUnitChange}
                />
            ) : null}

            {!supportsTimer(timerMode) && (
                <div
                    className="rounded-xl border border-dashed px-3 py-2 text-sm"
                    style={{
                        borderColor: 'var(--tt-border)',
                        background: 'var(--tt-surface-muted)',
                        color: 'var(--tt-text-soft)',
                    }}
                >
                    Note mode keeps this entry untimed and skips timer, duration, deadline, and urgency behavior.
                </div>
            )}

            <PrioritySelect priority={priority} onChange={onPriorityChange} />

            <div className="flex flex-col">
                <div className="mb-1 text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                    Workspace override
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

            {supportsTimer(timerMode) && (
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
            )}

            <div
                className="flex flex-wrap items-center justify-end gap-2 border-t pt-3"
                style={{ borderColor: 'rgba(15, 23, 42, 0.05)' }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    onMouseEnter={() => setHoveredAction('cancel')}
                    onMouseLeave={() => setHoveredAction((current) => current === 'cancel' ? null : current)}
                    className="rounded-xl border px-3 py-2 text-sm font-medium transition-[border-color,background-color,color] duration-150 ease-out"
                    style={cancelButtonStyle}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onReset}
                    onMouseEnter={() => setHoveredAction('reset')}
                    onMouseLeave={() => setHoveredAction((current) => current === 'reset' ? null : current)}
                    className="rounded-xl border px-3 py-2 text-sm font-medium transition-[border-color,background-color,color] duration-150 ease-out"
                    style={resetButtonStyle}
                >
                    Reset
                </button>
                <button
                    type="submit"
                    disabled={!canApply}
                    onMouseEnter={() => setHoveredAction('apply')}
                    onMouseLeave={() => setHoveredAction((current) => current === 'apply' ? null : current)}
                    className="rounded-xl border px-3 py-2 text-sm font-medium transition-[border-color,background-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60"
                    style={applyButtonStyle}
                >
                    Apply
                </button>
            </div>
        </div>
    );
}

