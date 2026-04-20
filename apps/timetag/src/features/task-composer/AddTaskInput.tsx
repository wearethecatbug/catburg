'use client';

import React, { forwardRef } from 'react';
import type { AssignableWorkspaceType, TimerMode } from '@/domain/task.types';
import {
  PlusIcon,
  ClockIcon,
  ChevronDownIcon,
  HourglassIcon,
  CalendarIcon,
  PomodoroIcon,
} from '@/shared';
import { Dropdown, DetailsPanel, type DropdownOption } from './components';
import { useTaskComposerState } from './useTaskComposerState';

interface AddTaskInputProps {
  defaultWorkspace?: AssignableWorkspaceType;
}

const MODE_OPTIONS: DropdownOption[] = [
  { id: 'duration', label: 'Duration', icon: <HourglassIcon size="sm" /> },
  { id: 'pomodoro', label: 'Pomodoro', icon: <PomodoroIcon size="sm" /> },
  { id: 'deadline', label: 'Deadline', icon: <CalendarIcon size="sm" /> },
];

function getModeLabel(timerMode: TimerMode): string {
  return timerMode === 'duration'
    ? 'Duration'
    : timerMode === 'deadline'
      ? 'Deadline'
      : 'Pomodoro';
}

function renderModeIcon(timerMode: TimerMode) {
  if (timerMode === 'duration') return <HourglassIcon size="sm" />;
  if (timerMode === 'deadline') return <CalendarIcon size="sm" />;
  return <PomodoroIcon size="sm" />;
}

export const AddTaskInput = forwardRef<HTMLInputElement, AddTaskInputProps>(function AddTaskInput(
  { defaultWorkspace },
  ref,
) {
  const {
    title,
    setTitle,
    setInputRef,
    showDetails,
    toggleDetails,
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
    setWorkspaceOpen,
    showWorkspaceDropdown,
    showWorkspaceEmptyState,
    workspaceHelperText,
    workspaceOptions,
    selectedWorkspaceOptionId,
    selectedWorkspaceLabel,
    modeOpen,
    setModeOpen,
    presetOpen,
    setPresetOpen,
    currentPresetLabel,
    currentPresetOptions,
    currentPresetId,
    deadlinePresetLabel,
    deadlinePresetOptions,
    selectedDeadlinePresetId,
    canSubmit,
    handleSubmit,
    handleModeSelect,
    handlePresetSelect,
    handleDeadlinePresetSelect,
    handleWorkspaceOverrideSelect,
    handleDurationSecChange,
    handleDurationUnitChange,
    handleAutoResetChange,
    handleOverdueChange,
    handleCancelDetails,
    handleResetDetails,
    setPriority,
    setNote,
    setDeadlineDate,
    setPomoCycles,
    setPomoWorkMin,
    setPomoShortBreakMin,
    setPomoLongBreakMin,
    setAutoEnabled,
    setPlayEnabled,
  } = useTaskComposerState({ defaultWorkspace, forwardedRef: ref });
  const modeLabel = getModeLabel(timerMode);

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      <div
        className="relative overflow-visible rounded-[18px] border"
        style={{
          borderColor: 'var(--tt-border)',
          background: 'var(--tt-surface)',
          boxShadow: 'var(--tt-shadow)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2.5 p-2.5">
          <div className="relative min-w-[220px] flex-1">
            <label className="sr-only" htmlFor="task-title">
              Task title
            </label>
            <input
              id="task-title"
              ref={setInputRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a new task..."
              className="w-full rounded-xl border px-3 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--tt-ring)]"
              style={{
                borderColor: 'var(--tt-border)',
                background: 'var(--tt-input-bg)',
                color: 'var(--tt-text)',
              }}
              aria-label="Add a new task"
            />
          </div>

          <Dropdown
            id="task-mode-btn"
            label="Timer mode"
            icon={renderModeIcon(timerMode)}
            buttonContent={
              <>
                <span className="whitespace-nowrap">{modeLabel}</span>
                <ChevronDownIcon size="sm" />
              </>
            }
            options={MODE_OPTIONS}
            selectedId={timerMode}
            isOpen={modeOpen}
            onToggle={() => setModeOpen((current) => !current)}
            onSelect={(id) => handleModeSelect(id as TimerMode)}
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
              onToggle={() => setPresetOpen((current) => !current)}
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
                  <span className="whitespace-nowrap">{deadlinePresetLabel}</span>
                  <ChevronDownIcon size="sm" />
                </>
              }
              options={deadlinePresetOptions}
              selectedId={selectedDeadlinePresetId}
              isOpen={presetOpen}
              onToggle={() => setPresetOpen((current) => !current)}
              onSelect={handleDeadlinePresetSelect}
              onClose={() => setPresetOpen(false)}
              title="Deadline preset"
              ariaLabel="Deadline preset options"
            />
          )}

          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={toggleDetails}
              className="flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus:outline-none hover:bg-[var(--tt-surface-hover)]"
              style={{
                borderColor: showDetails ? 'rgba(79, 125, 243, 0.08)' : 'var(--tt-border)',
                background: showDetails ? 'var(--tt-chip-active-bg)' : 'var(--tt-surface-subtle)',
                color: showDetails ? 'var(--tt-chip-active-text)' : 'var(--tt-text)',
              }}
              aria-expanded={showDetails}
              aria-controls="task-composer-details"
              title="Show details"
            >
              {showDetails ? 'Hide details' : '+ Details'}
            </button>
          </div>

          <div className="flex-shrink-0">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-transform duration-150 hover:-translate-y-px active:translate-y-0 focus:outline-none"
              style={{
                background: 'linear-gradient(180deg, #5b8cff 0%, var(--tt-accent) 100%)',
                color: 'var(--tt-accent-contrast)',
                boxShadow: '0 6px 16px rgba(79, 125, 243, 0.25)',
              }}
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
            note={note}
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
            workspaceOpen={workspaceOpen}
            showWorkspaceDropdown={showWorkspaceDropdown}
            showWorkspaceEmptyState={showWorkspaceEmptyState}
            workspaceHelperText={workspaceHelperText}
            workspaceOptions={workspaceOptions}
            selectedWorkspaceOptionId={selectedWorkspaceOptionId}
            selectedWorkspaceLabel={selectedWorkspaceLabel}
            onTimerModeChange={handleModeSelect}
            onWorkspaceOpenChange={setWorkspaceOpen}
            onWorkspaceSelect={handleWorkspaceOverrideSelect}
            onPriorityChange={setPriority}
            onNoteChange={setNote}
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
            onCancel={handleCancelDetails}
            onReset={handleResetDetails}
            canSubmit={canSubmit}
          />
        )}
      </div>
    </form>
  );
});