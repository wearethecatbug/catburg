'use client';

import React from 'react';
import {
  formatDurationValue,
  DURATION_PRESETS,
  getVisibleDurationPresetById,
  getVisibleDurationPresets,
  toDurationSec,
  type DurationPresetId,
  type DurationUnit,
} from '@/domain/duration';
import {
  clampDeadlineOffsetSec,
  formatDeadlineOffsetLabel,
  getDeadlineUnitFromSec,
  DEADLINE_PRESETS,
  formatNamedPomodoroPresetLabel,
  getVisibleDeadlinePresetById,
  getVisibleDeadlinePresets,
  getVisiblePomodoroPresetById,
  getVisiblePomodoroPresets,
  POMODORO_PRESETS,
  type DeadlinePresetId,
  type PomodoroPresetId,
} from '@/domain/timer.presets';
import type { AppSettings, TimerSettings, TimerTabId } from '@/domain/settings.types';
import { NumberInput } from '@/features/task-composer/components';

interface TimerSettingsSectionProps {
  activeTab: TimerTabId;
  settings: AppSettings;
  updateTimer: (patch: Partial<TimerSettings>) => void;
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
      <span className="space-y-1">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="block text-xs text-gray-500">{description}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </label>
  );
}

const DURATION_UNIT_OPTIONS: Array<{ value: DurationUnit; label: string }> = [
  { value: 'min', label: 'min' },
  { value: 'h', label: 'h' },
  { value: 'd', label: 'd' },
];

function getDurationUnitFromSec(valueSec: number): DurationUnit {
  if (valueSec % 86400 === 0) return 'd';
  if (valueSec % 3600 === 0) return 'h';
  return 'min';
}

export function TimerSettingsSection({ activeTab, settings, updateTimer }: TimerSettingsSectionProps) {
  const visibleDurationPresets = getVisibleDurationPresets(settings.timer.hiddenDurationPresetIds);
  const visiblePomodoroPresets = getVisiblePomodoroPresets(settings.timer.hiddenPomodoroPresetIds);
  const visibleDeadlinePresets = getVisibleDeadlinePresets(settings.timer.hiddenDeadlinePresetIds);
  const hasCustomPomodoroValues = !visiblePomodoroPresets.some((preset) => (
    preset.cycles === settings.timer.pomodoroDefaults.cycles &&
    preset.workDurationMin === settings.timer.pomodoroDefaults.workDurationMin &&
    preset.shortBreakMin === settings.timer.pomodoroDefaults.shortBreakMin &&
    preset.longBreakMin === settings.timer.pomodoroDefaults.longBreakMin
  ));
  const matchingDurationPreset = visibleDurationPresets.find(
    (preset) => preset.durationSec === settings.timer.durationDefaults.durationSec,
  );
  const matchingDeadlinePreset = visibleDeadlinePresets.find(
    (preset) => preset.offsetSec === settings.timer.deadlineDefaults.offsetSec,
  );
  const [durationUnit, setDurationUnit] = React.useState<DurationUnit>(() => getDurationUnitFromSec(settings.timer.durationDefaults.durationSec));
  const [durationValue, setDurationValue] = React.useState(() =>
    formatDurationValue(settings.timer.durationDefaults.durationSec, getDurationUnitFromSec(settings.timer.durationDefaults.durationSec)),
  );
  const [durationPresetSelectionId, setDurationPresetSelectionId] = React.useState<DurationPresetId>(settings.timer.durationDefaults.presetId);
  const [pomodoroPresetSelectionId, setPomodoroPresetSelectionId] = React.useState<PomodoroPresetId>(settings.timer.pomodoroDefaults.presetId);
  const [deadlinePresetSelectionId, setDeadlinePresetSelectionId] = React.useState<DeadlinePresetId>(settings.timer.deadlineDefaults.presetId);
  const [deadlineUnit, setDeadlineUnit] = React.useState<DurationUnit>(() => getDeadlineUnitFromSec(settings.timer.deadlineDefaults.offsetSec));
  const [deadlineValue, setDeadlineValue] = React.useState(() =>
    formatDurationValue(settings.timer.deadlineDefaults.offsetSec, getDeadlineUnitFromSec(settings.timer.deadlineDefaults.offsetSec)),
  );
  const previousDurationSecRef = React.useRef(settings.timer.durationDefaults.durationSec);
  const previousDeadlineOffsetSecRef = React.useRef(settings.timer.deadlineDefaults.offsetSec);
  const isSelectedDurationPresetHidden = settings.timer.hiddenDurationPresetIds.includes(durationPresetSelectionId);
  const isSelectedPomodoroPresetHidden = settings.timer.hiddenPomodoroPresetIds.includes(pomodoroPresetSelectionId);
  const isSelectedDeadlinePresetHidden = settings.timer.hiddenDeadlinePresetIds.includes(deadlinePresetSelectionId);

  React.useEffect(() => {
    if (previousDurationSecRef.current === settings.timer.durationDefaults.durationSec) {
      return;
    }

    previousDurationSecRef.current = settings.timer.durationDefaults.durationSec;
    setDurationValue(formatDurationValue(settings.timer.durationDefaults.durationSec, durationUnit));
  }, [durationUnit, settings.timer.durationDefaults.durationSec]);

  React.useEffect(() => {
    if (!settings.timer.hiddenDurationPresetIds.includes(durationPresetSelectionId)) {
      setDurationPresetSelectionId(settings.timer.durationDefaults.presetId);
    }
  }, [durationPresetSelectionId, settings.timer.durationDefaults.presetId, settings.timer.hiddenDurationPresetIds]);

  React.useEffect(() => {
    if (!settings.timer.hiddenPomodoroPresetIds.includes(pomodoroPresetSelectionId)) {
      setPomodoroPresetSelectionId(settings.timer.pomodoroDefaults.presetId);
    }
  }, [pomodoroPresetSelectionId, settings.timer.hiddenPomodoroPresetIds, settings.timer.pomodoroDefaults.presetId]);

  React.useEffect(() => {
    if (!settings.timer.hiddenDeadlinePresetIds.includes(deadlinePresetSelectionId)) {
      setDeadlinePresetSelectionId(settings.timer.deadlineDefaults.presetId);
    }
  }, [deadlinePresetSelectionId, settings.timer.deadlineDefaults.presetId, settings.timer.hiddenDeadlinePresetIds]);

  React.useEffect(() => {
    if (previousDeadlineOffsetSecRef.current === settings.timer.deadlineDefaults.offsetSec) {
      return;
    }

    previousDeadlineOffsetSecRef.current = settings.timer.deadlineDefaults.offsetSec;
    setDeadlineValue(formatDurationValue(settings.timer.deadlineDefaults.offsetSec, deadlineUnit));
  }, [deadlineUnit, settings.timer.deadlineDefaults.offsetSec]);

  const handleDurationPresetChange = (presetId: typeof settings.timer.durationDefaults.presetId) => {
    const preset = getVisibleDurationPresetById(presetId, settings.timer.hiddenDurationPresetIds);
    setDurationUnit(getDurationUnitFromSec(preset.durationSec));
    updateTimer({
      durationDefaults: {
        presetId: preset.id,
        durationSec: preset.durationSec,
      },
    });
  };

  const toggleDurationPresetVisibility = (presetId: typeof settings.timer.durationDefaults.presetId) => {
    const isHidden = settings.timer.hiddenDurationPresetIds.includes(presetId);
    if (isHidden) {
      updateTimer({
        hiddenDurationPresetIds: settings.timer.hiddenDurationPresetIds.filter((id) => id !== presetId),
      });
      return;
    }

    if (visibleDurationPresets.length <= 1) return;

    const nextHidden = [...settings.timer.hiddenDurationPresetIds, presetId];
    const fallbackPreset = getVisibleDurationPresetById(undefined, nextHidden);
    const isSelectedPreset = settings.timer.durationDefaults.presetId === presetId;

    if (isSelectedPreset) {
      setDurationUnit(getDurationUnitFromSec(fallbackPreset.durationSec));
    }

    updateTimer({
      hiddenDurationPresetIds: nextHidden,
      durationDefaults:
        isSelectedPreset
          ? { presetId: fallbackPreset.id, durationSec: fallbackPreset.durationSec }
          : settings.timer.durationDefaults,
    });
  };

  const handlePomodoroPresetChange = (presetId: typeof settings.timer.pomodoroDefaults.presetId) => {
    const preset = getVisiblePomodoroPresetById(presetId, settings.timer.hiddenPomodoroPresetIds);
    updateTimer({
      pomodoroDefaults: {
        presetId: preset.id,
        cycles: preset.cycles,
        workDurationMin: preset.workDurationMin,
        shortBreakMin: preset.shortBreakMin,
        longBreakMin: preset.longBreakMin,
      },
    });
  };

  const togglePomodoroPresetVisibility = (presetId: typeof settings.timer.pomodoroDefaults.presetId) => {
    const isHidden = settings.timer.hiddenPomodoroPresetIds.includes(presetId);
    if (isHidden) {
      updateTimer({
        hiddenPomodoroPresetIds: settings.timer.hiddenPomodoroPresetIds.filter((id) => id !== presetId),
      });
      return;
    }

    if (visiblePomodoroPresets.length <= 1) return;

    const nextHidden = [...settings.timer.hiddenPomodoroPresetIds, presetId];
    const fallbackPreset = getVisiblePomodoroPresetById(undefined, nextHidden);

    updateTimer({
      hiddenPomodoroPresetIds: nextHidden,
      pomodoroDefaults:
        settings.timer.pomodoroDefaults.presetId === presetId
          ? {
              presetId: fallbackPreset.id,
              cycles: fallbackPreset.cycles,
              workDurationMin: fallbackPreset.workDurationMin,
              shortBreakMin: fallbackPreset.shortBreakMin,
              longBreakMin: fallbackPreset.longBreakMin,
            }
          : settings.timer.pomodoroDefaults,
    });
  };

  const handleDeadlinePresetChange = (presetId: typeof settings.timer.deadlineDefaults.presetId) => {
    const preset = getVisibleDeadlinePresetById(presetId, settings.timer.hiddenDeadlinePresetIds);
    setDeadlineUnit(getDeadlineUnitFromSec(preset.offsetSec));
    updateTimer({
      deadlineDefaults: {
        presetId: preset.id,
        offsetSec: preset.offsetSec,
      },
    });
  };

  const toggleDeadlinePresetVisibility = (presetId: typeof settings.timer.deadlineDefaults.presetId) => {
    const isHidden = settings.timer.hiddenDeadlinePresetIds.includes(presetId);
    if (isHidden) {
      updateTimer({
        hiddenDeadlinePresetIds: settings.timer.hiddenDeadlinePresetIds.filter((id) => id !== presetId),
      });
      return;
    }

    if (visibleDeadlinePresets.length <= 1) return;

    const nextHidden = [...settings.timer.hiddenDeadlinePresetIds, presetId];
    const fallbackPreset = getVisibleDeadlinePresetById(undefined, nextHidden);
    const isSelectedPreset = settings.timer.deadlineDefaults.presetId === presetId;

    if (isSelectedPreset) {
      setDeadlineUnit(getDeadlineUnitFromSec(fallbackPreset.offsetSec));
    }

    updateTimer({
      hiddenDeadlinePresetIds: nextHidden,
      deadlineDefaults:
        isSelectedPreset
          ? { presetId: fallbackPreset.id, offsetSec: fallbackPreset.offsetSec }
          : settings.timer.deadlineDefaults,
    });
  };

  const handleDurationPresetSelectionChange = (presetId: DurationPresetId) => {
    setDurationPresetSelectionId(presetId);
    if (!settings.timer.hiddenDurationPresetIds.includes(presetId)) {
      handleDurationPresetChange(presetId);
    }
  };

  const handlePomodoroPresetSelectionChange = (presetId: PomodoroPresetId) => {
    setPomodoroPresetSelectionId(presetId);
    if (!settings.timer.hiddenPomodoroPresetIds.includes(presetId)) {
      handlePomodoroPresetChange(presetId);
    }
  };

  const handleDeadlinePresetSelectionChange = (presetId: DeadlinePresetId) => {
    setDeadlinePresetSelectionId(presetId);
    if (!settings.timer.hiddenDeadlinePresetIds.includes(presetId)) {
      handleDeadlinePresetChange(presetId);
    }
  };

  const handleDurationValueChange = (value: string) => {
    setDurationValue(value);

    if (value.trim() === '') return;

    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;

    updateTimer({
      durationDefaults: {
        ...settings.timer.durationDefaults,
        durationSec: toDurationSec(parsed, durationUnit),
      },
    });
  };

  const handleDurationValueBlur = () => {
    if (durationValue.trim() === '') {
      setDurationValue(formatDurationValue(settings.timer.durationDefaults.durationSec, durationUnit));
      return;
    }

    const parsed = Number(durationValue);
    if (Number.isNaN(parsed)) {
      setDurationValue(formatDurationValue(settings.timer.durationDefaults.durationSec, durationUnit));
      return;
    }

    const nextDurationSec = toDurationSec(parsed, durationUnit);
    updateTimer({
      durationDefaults: {
        ...settings.timer.durationDefaults,
        durationSec: nextDurationSec,
      },
    });
    setDurationValue(formatDurationValue(nextDurationSec, durationUnit));
  };

  const handleDurationUnitChange = (unit: DurationUnit) => {
    const parsed = Number(durationValue);
    setDurationUnit(unit);

    if (durationValue.trim() === '' || Number.isNaN(parsed)) return;

    updateTimer({
      durationDefaults: {
        ...settings.timer.durationDefaults,
        durationSec: toDurationSec(parsed, unit),
      },
    });
  };

  const handleDeadlineValueChange = (value: string) => {
    setDeadlineValue(value);

    if (value.trim() === '') return;

    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;

    updateTimer({
      deadlineDefaults: {
        ...settings.timer.deadlineDefaults,
        offsetSec: clampDeadlineOffsetSec(toDurationSec(parsed, deadlineUnit)),
      },
    });
  };

  const handleDeadlineValueBlur = () => {
    if (deadlineValue.trim() === '') {
      setDeadlineValue(formatDurationValue(settings.timer.deadlineDefaults.offsetSec, deadlineUnit));
      return;
    }

    const parsed = Number(deadlineValue);
    if (Number.isNaN(parsed)) {
      setDeadlineValue(formatDurationValue(settings.timer.deadlineDefaults.offsetSec, deadlineUnit));
      return;
    }

    const nextOffsetSec = clampDeadlineOffsetSec(toDurationSec(parsed, deadlineUnit));
    updateTimer({
      deadlineDefaults: {
        ...settings.timer.deadlineDefaults,
        offsetSec: nextOffsetSec,
      },
    });
    setDeadlineValue(formatDurationValue(nextOffsetSec, deadlineUnit));
  };

  const handleDeadlineUnitChange = (unit: DurationUnit) => {
    const parsed = Number(deadlineValue);
    setDeadlineUnit(unit);

    if (deadlineValue.trim() === '' || Number.isNaN(parsed)) return;

    updateTimer({
      deadlineDefaults: {
        ...settings.timer.deadlineDefaults,
        offsetSec: clampDeadlineOffsetSec(toDurationSec(parsed, unit)),
      },
    });
  };

  if (activeTab === 'mode') {
    return (
      <div className="space-y-3">
        <Field label="Default mode" description="Preselect this mode in the task composer.">
          <select
            value={settings.timer.defaultMode}
            onChange={(e) => updateTimer({ defaultMode: e.target.value as typeof settings.timer.defaultMode })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Default mode"
          >
            <option value="duration">Duration</option>
            <option value="pomodoro">Pomodoro</option>
            <option value="deadline">Deadline</option>
          </select>
        </Field>
      </div>
    );
  }

  if (activeTab === 'presets') {
    return (
      <div className="space-y-3">
        <Field label="Default duration preset" description="Used when the task composer opens in Duration mode.">
          <div className="w-[420px] space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={durationPresetSelectionId}
                onChange={(e) => handleDurationPresetSelectionChange(e.target.value as DurationPresetId)}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
                aria-label="Default duration preset"
              >
                {DURATION_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {settings.timer.hiddenDurationPresetIds.includes(preset.id) ? `(Hidden) ${preset.label}` : preset.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toggleDurationPresetVisibility(durationPresetSelectionId)}
                disabled={!isSelectedDurationPresetHidden && visibleDurationPresets.length <= 1}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSelectedDurationPresetHidden ? 'Restore' : 'Hide'}
              </button>
            </div>

            <div className="space-y-1">
              <label htmlFor="settings-duration-default-value" className="block text-xs font-medium text-gray-700">
                Duration
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-duration-default-value"
                  type="number"
                  inputMode="decimal"
                  step={durationUnit === 'min' ? 1 : 'any'}
                  min={durationUnit === 'min' ? 1 : 0.01}
                  value={durationValue}
                  onChange={(e) => handleDurationValueChange(e.target.value)}
                  onBlur={handleDurationValueBlur}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Default duration value"
                />
                <select
                  value={durationUnit}
                  onChange={(e) => handleDurationUnitChange(e.target.value as DurationUnit)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Default duration unit"
                >
                  {DURATION_UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-gray-500">
                {matchingDurationPreset
                  ? `Current value matches ${matchingDurationPreset.label}.`
                  : 'Edited duration is saved as a custom default.'}
              </p>
            </div>
          </div>
        </Field>

        <Field label="Default pomodoro preset" description="Used when the task composer opens in Pomodoro mode.">
          <div className="w-[420px] space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={pomodoroPresetSelectionId}
                onChange={(e) => handlePomodoroPresetSelectionChange(e.target.value as PomodoroPresetId)}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
                aria-label="Default pomodoro preset"
              >
                {POMODORO_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {settings.timer.hiddenPomodoroPresetIds.includes(preset.id)
                      ? `(Hidden) ${formatNamedPomodoroPresetLabel(preset)}`
                      : formatNamedPomodoroPresetLabel(preset)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => togglePomodoroPresetVisibility(pomodoroPresetSelectionId)}
                disabled={!isSelectedPomodoroPresetHidden && visiblePomodoroPresets.length <= 1}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSelectedPomodoroPresetHidden ? 'Restore' : 'Hide'}
              </button>
            </div>

            {hasCustomPomodoroValues && (
              <p className="text-xs text-blue-600">Custom values active for the selected Pomodoro preset.</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                id="settings-pomodoro-cycles"
                label="Cycles"
                value={settings.timer.pomodoroDefaults.cycles}
                onChange={(value) => updateTimer({
                  pomodoroDefaults: { ...settings.timer.pomodoroDefaults, cycles: value },
                })}
                min={1}
                max={12}
                ariaLabel="Default pomodoro cycles"
              />
              <NumberInput
                id="settings-pomodoro-work"
                label="Work"
                value={settings.timer.pomodoroDefaults.workDurationMin}
                onChange={(value) => updateTimer({
                  pomodoroDefaults: { ...settings.timer.pomodoroDefaults, workDurationMin: value },
                })}
                min={1}
                max={240}
                unit="minutes"
                ariaLabel="Default pomodoro work duration in minutes"
              />
              <NumberInput
                id="settings-pomodoro-short-break"
                label="Short break"
                value={settings.timer.pomodoroDefaults.shortBreakMin}
                onChange={(value) => updateTimer({
                  pomodoroDefaults: { ...settings.timer.pomodoroDefaults, shortBreakMin: value },
                })}
                min={1}
                max={120}
                unit="minutes"
                ariaLabel="Default pomodoro short break duration in minutes"
              />
              <NumberInput
                id="settings-pomodoro-long-break"
                label="Long break"
                value={settings.timer.pomodoroDefaults.longBreakMin}
                onChange={(value) => updateTimer({
                  pomodoroDefaults: { ...settings.timer.pomodoroDefaults, longBreakMin: value },
                })}
                min={1}
                max={180}
                unit="minutes"
                ariaLabel="Default pomodoro long break duration in minutes"
              />
            </div>
          </div>
        </Field>

        <Field label="Default deadline preset" description="Used when the task composer opens in Deadline mode.">
          <div className="w-[420px] space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={deadlinePresetSelectionId}
                onChange={(e) => handleDeadlinePresetSelectionChange(e.target.value as DeadlinePresetId)}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
                aria-label="Default deadline preset"
              >
                {DEADLINE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {settings.timer.hiddenDeadlinePresetIds.includes(preset.id) ? `(Hidden) ${preset.label}` : preset.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toggleDeadlinePresetVisibility(deadlinePresetSelectionId)}
                disabled={!isSelectedDeadlinePresetHidden && visibleDeadlinePresets.length <= 1}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSelectedDeadlinePresetHidden ? 'Restore' : 'Hide'}
              </button>
            </div>

            <div className="space-y-1">
              <label htmlFor="settings-deadline-default-value" className="block text-xs font-medium text-gray-700">
                Deadline offset
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-deadline-default-value"
                  type="number"
                  inputMode="decimal"
                  step={deadlineUnit === 'min' ? 1 : 'any'}
                  min={deadlineUnit === 'min' ? 1 : 0.01}
                  value={deadlineValue}
                  onChange={(e) => handleDeadlineValueChange(e.target.value)}
                  onBlur={handleDeadlineValueBlur}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Default deadline value"
                />
                <select
                  value={deadlineUnit}
                  onChange={(e) => handleDeadlineUnitChange(e.target.value as DurationUnit)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Default deadline unit"
                >
                  {DURATION_UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-gray-500">
                {matchingDeadlinePreset
                  ? `Current value matches ${matchingDeadlinePreset.label}.`
                  : `Edited deadline is saved as a custom default (${formatDeadlineOffsetLabel(settings.timer.deadlineDefaults.offsetSec)}).`}
              </p>
            </div>
          </div>
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Allow multiple timers" description="Permit more than one task timer to run at the same time.">
        <input
          type="checkbox"
          checked={settings.timer.allowMultipleTimers}
          onChange={(e) => updateTimer({ allowMultipleTimers: e.target.checked })}
          aria-label="Allow multiple timers"
        />
      </Field>

      <Field label="Overtime behavior" description="Choose whether timers continue into overtime or stop at zero.">
        <select
          value={settings.timer.overtimeBehavior}
          onChange={(e) => updateTimer({ overtimeBehavior: e.target.value as typeof settings.timer.overtimeBehavior })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          aria-label="Overtime behavior"
        >
          <option value="continue">Continue counting</option>
          <option value="stop">Stop at zero</option>
        </select>
      </Field>

      <Field label="Show seconds in timer" description="Reserved for timer display formatting in a follow-up iteration.">
        <input
          type="checkbox"
          checked={settings.timer.showSecondsInTimer}
          onChange={(e) => updateTimer({ showSecondsInTimer: e.target.checked })}
          aria-label="Show seconds in timer"
        />
      </Field>
    </div>
  );
}

