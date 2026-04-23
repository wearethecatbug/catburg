import { clampDurationSec, filterDurationPresetIds, getVisibleDurationPresetById, isDurationPresetId } from './duration';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
} from './settings.types';
import { clampNumber, isContentWidthMode, isOvertimeBehavior, isRecord, isTimerMode } from './settings.guards';
import { normalizeCustomThemeSettings, isThemeMode } from './theme';
import {
  clampDeadlineOffsetSec,
  filterDeadlinePresetIds,
  filterPomodoroPresetIds,
  getVisibleDeadlinePresetById,
  getVisiblePomodoroPresetById,
} from './timer.presets';
import { isAssignableWorkspaceType } from './workspace';

export function normalizeSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;

  const general = isRecord(raw.general) ? raw.general : {};
  const timer = isRecord(raw.timer) ? raw.timer : {};
  const appearance = isRecord(raw.appearance) ? raw.appearance : {};
  const customTheme = normalizeCustomThemeSettings(appearance.customTheme);
  const legacyDefaultTimerPreset = isDurationPresetId(general.defaultTimerPreset)
    ? general.defaultTimerPreset
    : undefined;
  const durationDefaults = isRecord(timer.durationDefaults) ? timer.durationDefaults : {};
  const pomodoroDefaults = isRecord(timer.pomodoroDefaults) ? timer.pomodoroDefaults : {};
  const deadlineDefaults = isRecord(timer.deadlineDefaults) ? timer.deadlineDefaults : {};
  const hiddenDurationPresetIds = filterDurationPresetIds(timer.hiddenDurationPresetIds);
  const hiddenPomodoroPresetIds = filterPomodoroPresetIds(timer.hiddenPomodoroPresetIds);
  const hiddenDeadlinePresetIds = filterDeadlinePresetIds(timer.hiddenDeadlinePresetIds);
  const resolvedDurationPreset = getVisibleDurationPresetById(
    durationDefaults.presetId ?? legacyDefaultTimerPreset,
    hiddenDurationPresetIds,
  );
  const resolvedPomodoroPreset = getVisiblePomodoroPresetById(
    pomodoroDefaults.presetId,
    hiddenPomodoroPresetIds,
  );
  const resolvedDeadlinePreset = getVisibleDeadlinePresetById(
    deadlineDefaults.presetId,
    hiddenDeadlinePresetIds,
  );

  return {
    version: 4,
    general: {
      autoStartTimerWhenTaskCreated:
        typeof general.autoStartTimerWhenTaskCreated === 'boolean'
          ? general.autoStartTimerWhenTaskCreated
          : DEFAULT_SETTINGS.general.autoStartTimerWhenTaskCreated,
      autoPauseOtherTimers:
        typeof general.autoPauseOtherTimers === 'boolean'
          ? general.autoPauseOtherTimers
          : DEFAULT_SETTINGS.general.autoPauseOtherTimers,
      confirmBeforeDelete:
        typeof general.confirmBeforeDelete === 'boolean'
          ? general.confirmBeforeDelete
          : DEFAULT_SETTINGS.general.confirmBeforeDelete,
      defaultWorkspace: isAssignableWorkspaceType(general.defaultWorkspace)
        ? general.defaultWorkspace
        : DEFAULT_SETTINGS.general.defaultWorkspace,
      showCompletedTasks:
        typeof general.showCompletedTasks === 'boolean'
          ? general.showCompletedTasks
          : DEFAULT_SETTINGS.general.showCompletedTasks,
      showUrgencyIndicator:
        typeof general.showUrgencyIndicator === 'boolean'
          ? general.showUrgencyIndicator
          : DEFAULT_SETTINGS.general.showUrgencyIndicator,
      showNotePreviewsInTaskList:
        typeof general.showNotePreviewsInTaskList === 'boolean'
          ? general.showNotePreviewsInTaskList
          : DEFAULT_SETTINGS.general.showNotePreviewsInTaskList,
    },
    timer: {
      defaultMode: isTimerMode(timer.defaultMode)
        ? timer.defaultMode
        : DEFAULT_SETTINGS.timer.defaultMode,
      allowMultipleTimers:
        typeof timer.allowMultipleTimers === 'boolean'
          ? timer.allowMultipleTimers
          : DEFAULT_SETTINGS.timer.allowMultipleTimers,
      overtimeBehavior: isOvertimeBehavior(timer.overtimeBehavior)
        ? timer.overtimeBehavior
        : DEFAULT_SETTINGS.timer.overtimeBehavior,
      showSecondsInTimer:
        typeof timer.showSecondsInTimer === 'boolean'
          ? timer.showSecondsInTimer
          : DEFAULT_SETTINGS.timer.showSecondsInTimer,
      durationDefaults: {
        presetId: resolvedDurationPreset.id,
        durationSec: clampDurationSec(
          typeof durationDefaults.durationSec === 'number'
            ? durationDefaults.durationSec
            : resolvedDurationPreset.durationSec,
        ),
      },
      pomodoroDefaults: {
        presetId: resolvedPomodoroPreset.id,
        cycles: clampNumber(pomodoroDefaults.cycles, resolvedPomodoroPreset.cycles, 1, 12),
        workDurationMin: clampNumber(
          pomodoroDefaults.workDurationMin,
          resolvedPomodoroPreset.workDurationMin,
          1,
          240,
        ),
        shortBreakMin: clampNumber(
          pomodoroDefaults.shortBreakMin,
          resolvedPomodoroPreset.shortBreakMin,
          1,
          120,
        ),
        longBreakMin: clampNumber(
          pomodoroDefaults.longBreakMin,
          resolvedPomodoroPreset.longBreakMin,
          1,
          180,
        ),
      },
      deadlineDefaults: {
        presetId: resolvedDeadlinePreset.id,
        offsetSec: clampDeadlineOffsetSec(
          typeof deadlineDefaults.offsetSec === 'number'
            ? deadlineDefaults.offsetSec
            : typeof deadlineDefaults.days === 'number'
              ? deadlineDefaults.days * 86400
              : resolvedDeadlinePreset.offsetSec,
        ),
      },
      hiddenDurationPresetIds,
      hiddenPomodoroPresetIds,
      hiddenDeadlinePresetIds,
    },
    appearance: {
      themeMode: isThemeMode(appearance.themeMode)
        ? appearance.themeMode
        : DEFAULT_SETTINGS.appearance.themeMode,
      customTheme,
      contentWidthMode: isContentWidthMode(appearance.contentWidthMode)
        ? appearance.contentWidthMode
        : DEFAULT_SETTINGS.appearance.contentWidthMode,
      compactList:
        typeof appearance.compactList === 'boolean'
          ? appearance.compactList
          : DEFAULT_SETTINGS.appearance.compactList,
      animationsEnabled:
        typeof appearance.animationsEnabled === 'boolean'
          ? appearance.animationsEnabled
          : DEFAULT_SETTINGS.appearance.animationsEnabled,
      roundedCorners: clampNumber(
        appearance.roundedCorners,
        DEFAULT_SETTINGS.appearance.roundedCorners,
        0,
        24,
      ),
      ringThickness: clampNumber(
        appearance.ringThickness,
        DEFAULT_SETTINGS.appearance.ringThickness,
        1,
        6,
      ),
    },
  };
}

