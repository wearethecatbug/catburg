'use client';

import React, { forwardRef } from 'react';
import { TASK_NOTE_MAX_LENGTH, type AssignableWorkspaceType, type TimerMode } from '@/domain/task.types';
import { supportsTimer } from '@/domain/task.mode';
import {
  PlusIcon,
  ClockIcon,
  ChevronDownIcon,
  HourglassIcon,
  CalendarIcon,
  NoteIcon,
  PomodoroIcon,
} from '@/shared';
import { TASK_COMPOSER_TIMER_MODE_OPTIONS, getTaskComposerTimerModeLabel } from './task-composer.timer-mode';
import { Dropdown, MorePanel, type DropdownOption } from './components';
import { useTaskComposerState } from './useTaskComposerState';

interface AddTaskInputProps {
  defaultWorkspace?: AssignableWorkspaceType;
}

const MODE_OPTIONS: DropdownOption[] = TASK_COMPOSER_TIMER_MODE_OPTIONS.map((option) => ({
  ...option,
  icon: option.id === 'duration'
    ? <HourglassIcon size="sm" />
    : option.id === 'pomodoro'
      ? <PomodoroIcon size="sm" />
      : option.id === 'deadline'
        ? <CalendarIcon size="sm" />
        : <NoteIcon size="sm" />,
}));


const PRIMARY_CONTROL_SLOT_WIDTH = 'calc(8ch + 4.5rem)';

function renderModeIcon(timerMode: TimerMode) {
  if (timerMode === 'duration') return <HourglassIcon size="sm" />;
  if (timerMode === 'deadline') return <CalendarIcon size="sm" />;
  if (timerMode === 'pomodoro') return <PomodoroIcon size="sm" />;
  return <NoteIcon size="sm" />;
}

export const AddTaskInput = forwardRef<HTMLInputElement, AddTaskInputProps>(function AddTaskInput(
  { defaultWorkspace },
  ref,
) {
  const {
    title,
    setTitle,
    setInputRef,
    isNoteExpanded,
    toggleNote,
    showMore,
    toggleMore,
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
    advancedModeOpen,
    setAdvancedModeOpen,
    presetOpen,
    setPresetOpen,
    currentPresetLabel,
    currentPresetTriggerLabel,
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
  const modeLabel = getTaskComposerTimerModeLabel(timerMode);
  const isNoteActive = isNoteExpanded || note.trim().length > 0;
  const modeButtonClassName = 'justify-between';

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
        <div className="space-y-2.5 p-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5">
            <div className="relative min-w-0">
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

            <div className="flex-shrink-0">
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-transform duration-150 hover:-translate-y-px active:translate-y-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'linear-gradient(180deg, #5b8cff 0%, var(--tt-accent) 100%)',
                  color: 'var(--tt-accent-contrast)',
                  boxShadow: '0 6px 16px rgba(79, 125, 243, 0.25)',
                }}
                aria-label="Add task"
                title="Add task"
              >
                <PlusIcon size="sm" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
          </div>

          {isNoteExpanded && (
            <div className="space-y-1.5" id="task-note-inline">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="task-note-inline-input" className="text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                  Note
                </label>
                <span className="text-[11px]" style={{ color: 'var(--tt-text-soft)' }} aria-live="polite">
                  {note.length}/{TASK_NOTE_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="task-note-inline-input"
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, TASK_NOTE_MAX_LENGTH))}
                rows={3}
                maxLength={TASK_NOTE_MAX_LENGTH}
                placeholder="Add context, reminders, or next steps…"
                className="w-full resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]"
                style={{
                  borderColor: 'var(--tt-border)',
                  background: 'var(--tt-input-bg)',
                  color: 'var(--tt-text)',
                }}
                aria-describedby="task-note-inline-help"
              />
              <div id="task-note-inline-help" className="text-xs" style={{ color: 'var(--tt-text-soft)' }}>
                This note is saved with the task and collapses after a successful add.
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              id="task-mode-btn"
              label="Timer mode"
              icon={renderModeIcon(timerMode)}
              buttonClassName={modeButtonClassName}
                buttonStyle={{ width: PRIMARY_CONTROL_SLOT_WIDTH }}
              buttonContent={
                <span className="inline-flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="whitespace-nowrap">{modeLabel}</span>
                  <ChevronDownIcon size="sm" />
                </span>
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

            {supportsTimer(timerMode) && timerMode !== 'deadline' && (
              <Dropdown
                id="task-preset-btn"
                label={timerMode === 'pomodoro' ? 'Pomodoro preset' : 'Preset duration'}
                icon={<ClockIcon size="sm" />}
                buttonClassName="justify-between"
                buttonStyle={{ width: PRIMARY_CONTROL_SLOT_WIDTH }}
                buttonContent={
                  <span className="inline-flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="whitespace-nowrap">{currentPresetTriggerLabel}</span>
                    <ChevronDownIcon size="sm" />
                  </span>
                }
                options={currentPresetOptions}
                selectedId={currentPresetId}
                isOpen={presetOpen}
                onToggle={() => setPresetOpen((current) => !current)}
                onSelect={handlePresetSelect}
                onClose={() => setPresetOpen(false)}
                title={timerMode === 'pomodoro' ? currentPresetLabel : 'Preset duration'}
              />
            )}

            {supportsTimer(timerMode) && timerMode === 'deadline' && (
              <Dropdown
                id="task-deadline-preset-btn"
                label="Deadline preset"
                icon={<ClockIcon size="sm" />}
                buttonClassName="justify-between"
                buttonStyle={{ width: PRIMARY_CONTROL_SLOT_WIDTH }}
                buttonContent={
                  <span className="inline-flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="whitespace-nowrap">{deadlinePresetLabel}</span>
                    <ChevronDownIcon size="sm" />
                  </span>
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

            <button
              type="button"
              onClick={toggleNote}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--tt-surface-hover)] focus:outline-none"
              style={{
                borderColor: isNoteActive ? 'rgba(79, 125, 243, 0.08)' : 'var(--tt-border)',
                background: isNoteActive ? 'var(--tt-chip-active-bg)' : 'var(--tt-surface-subtle)',
                color: isNoteActive ? 'var(--tt-chip-active-text)' : 'var(--tt-text)',
              }}
              aria-expanded={isNoteExpanded}
              aria-controls="task-note-inline"
              aria-label="Toggle note"
              title="Toggle note"
            >
              <NoteIcon size="sm" />
              <span className="hidden sm:inline">Note</span>
            </button>

            <button
              type="button"
              onClick={toggleMore}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--tt-surface-hover)] focus:outline-none"
              style={{
                borderColor: showMore ? 'rgba(79, 125, 243, 0.08)' : 'var(--tt-border)',
                background: showMore ? 'var(--tt-chip-active-bg)' : 'var(--tt-surface-subtle)',
                color: showMore ? 'var(--tt-chip-active-text)' : 'var(--tt-text)',
              }}
              aria-expanded={showMore}
              aria-controls="task-composer-more"
              aria-label={showMore ? 'Hide details' : 'Details'}
              title={showMore ? 'Hide details' : 'Details'}
            >
              <span>{showMore ? 'Hide details' : 'Details'}</span>
            </button>
          </div>
        </div>

        {showMore && (
          <MorePanel
            timerMode={timerMode}
            priority={priority}
            canApply={canSubmit}
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
            timerModeOpen={advancedModeOpen}
            onWorkspaceOpenChange={setWorkspaceOpen}
            onTimerModeOpenChange={setAdvancedModeOpen}
            onWorkspaceSelect={handleWorkspaceOverrideSelect}
            onTimerModeChange={handleModeSelect}
            onPriorityChange={setPriority}
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
            onClose={handleCancelDetails}
            onReset={handleResetDetails}
          />
        )}
      </div>
    </form>
  );
});



