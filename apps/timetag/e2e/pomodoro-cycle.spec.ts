import { expect, test, type Page } from '@playwright/test';
import { gotoSeededPage } from './helpers/seed-app';
import { testSettings, type StoredTask } from './fixtures/timetag-state';
import type {
  PomodoroConfig,
  PomodoroSessionState,
  Task,
  TimerAudioEvent,
} from '@/domain/task.types';
import {
  createInitialPomodoroSession,
  getPomodoroDisplayMeta,
  resetTimerState,
  tickTimer,
  toggleTimerState,
} from '@/domain/timer.logic';
import { getTaskRowViewModel } from '@/entities/task/task-row.viewmodel';

const NOW_ISO = '2026-04-02T09:00:00.000Z';

function taskRow(page: Page, title: string) {
  return page.getByTestId('task-row').filter({ hasText: title }).first();
}

function createPomodoroConfig(overrides: Partial<PomodoroConfig> = {}): PomodoroConfig {
  return {
    cycles: 4,
    workDurationSec: 2,
    shortBreakDurationSec: 2,
    longBreakDurationSec: 2,
    autoStartBreak: true,
    autoStartNextWork: true,
    workDurationMin: 1,
    shortBreakMin: 1,
    longBreakMin: 1,
    ...overrides,
  };
}

function createPomodoroTask(overrides: Partial<Task> = {}): Task {
  const pomodoro = overrides.pomodoro ?? createPomodoroConfig();
  const pomodoroSession = overrides.pomodoroSession ?? createInitialPomodoroSession(pomodoro);

  return {
    id: 'pomodoro-task',
    title: 'Pomodoro task',
    workspace: 'work',
    status: 'active',
    priority: 'normal',
    timerMode: 'pomodoro',
    remainingSec: pomodoroSession.remainingSec,
    originalDurationSec: pomodoroSession.currentPhaseDurationSec,
    timerStatus: 'running',
    timerControls: {
      autoStart: false,
      autoPlay: true,
      autoReset: false,
      allowOverdue: false,
    },
    pomodoro,
    pomodoroSession,
    reminders: [],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

function applyTimerPatch(task: Task, patch: Partial<Task>): Task {
  return {
    ...task,
    ...patch,
  };
}

function tickOnce(task: Task): { task: Task; audioEvents: TimerAudioEvent[] } {
  const result = tickTimer(task);
  if (!result) {
    throw new Error('Expected tickTimer to return a result for a running task.');
  }

  return {
    task: applyTimerPatch(task, result.patch),
    audioEvents: result.audioEvents,
  };
}

function createStoredPomodoroTask(overrides: Partial<StoredTask> & Pick<StoredTask, 'id' | 'title'>): StoredTask {
  const pomodoro = overrides.pomodoro ?? createPomodoroConfig({
    cycles: 10,
    workDurationSec: 25 * 60,
    shortBreakDurationSec: 5 * 60,
    longBreakDurationSec: 15 * 60,
    workDurationMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
  });
  const pomodoroSession = overrides.pomodoroSession ?? createInitialPomodoroSession(pomodoro);

  return {
    id: overrides.id,
    title: overrides.title,
    workspace: 'work',
    status: 'active',
    priority: 'normal',
    timerMode: 'pomodoro',
    remainingSec: pomodoroSession.remainingSec,
    originalDurationSec: pomodoroSession.currentPhaseDurationSec,
    timerStatus: 'idle',
    timerControls: {
      autoStart: false,
      autoPlay: true,
      autoReset: false,
      allowOverdue: false,
    },
    pomodoro,
    pomodoroSession,
    reminders: [],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

test.describe('Pomodoro cycle engine', () => {
  test('advances a 4-cycle pomodoro through work, short breaks, long break, and finished', () => {
    let task = createPomodoroTask();

    expect(task.pomodoroSession).toMatchObject({
      phase: 'work',
      cycleIndex: 1,
      totalCycles: 4,
      completedWorkCycles: 0,
      completedShortBreaks: 0,
      remainingSec: 2,
    });

    ({ task } = tickOnce(task));
    expect(task.pomodoroSession).toMatchObject({ phase: 'work', cycleIndex: 1, remainingSec: 1 });

    let step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['workFinished', 'shortBreakStarted']);
    expect(task.pomodoroSession).toMatchObject({
      phase: 'shortBreak',
      cycleIndex: 1,
      completedWorkCycles: 1,
      completedShortBreaks: 0,
      remainingSec: 2,
    });
    expect(task.timerStatus).toBe('running');

    ({ task } = tickOnce(task));
    step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['shortBreakFinished']);
    expect(task.pomodoroSession).toMatchObject({
      phase: 'work',
      cycleIndex: 2,
      completedWorkCycles: 1,
      completedShortBreaks: 1,
      remainingSec: 2,
    });

    ({ task } = tickOnce(task));
    step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['workFinished', 'shortBreakStarted']);
    expect(task.pomodoroSession).toMatchObject({ phase: 'shortBreak', cycleIndex: 2, completedWorkCycles: 2, completedShortBreaks: 1 });

    ({ task } = tickOnce(task));
    step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['shortBreakFinished']);
    expect(task.pomodoroSession).toMatchObject({ phase: 'work', cycleIndex: 3, completedWorkCycles: 2, completedShortBreaks: 2 });

    ({ task } = tickOnce(task));
    step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['workFinished', 'shortBreakStarted']);
    expect(task.pomodoroSession).toMatchObject({ phase: 'shortBreak', cycleIndex: 3, completedWorkCycles: 3, completedShortBreaks: 2 });

    ({ task } = tickOnce(task));
    step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['shortBreakFinished']);
    expect(task.pomodoroSession).toMatchObject({ phase: 'work', cycleIndex: 4, completedWorkCycles: 3, completedShortBreaks: 3 });

    ({ task } = tickOnce(task));
    step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['workFinished', 'longBreakStarted']);
    expect(task.pomodoroSession).toMatchObject({
      phase: 'longBreak',
      cycleIndex: 4,
      completedWorkCycles: 4,
      completedShortBreaks: 3,
      remainingSec: 2,
    });

    ({ task } = tickOnce(task));
    step = tickOnce(task);
    task = step.task;
    expect(step.audioEvents).toEqual(['longBreakFinished', 'pomodoroSessionFinished']);
    expect(task.pomodoroSession).toMatchObject({
      phase: 'longBreak',
      cycleIndex: 4,
      completedWorkCycles: 4,
      completedShortBreaks: 3,
      remainingSec: 0,
    });
    expect(task.timerStatus).toBe('expired');
    expect(task.status).toBe('active');
  });

  test('handles a single-cycle pomodoro without short breaks', () => {
    let task = createPomodoroTask({
      pomodoro: createPomodoroConfig({ cycles: 1 }),
      pomodoroSession: createInitialPomodoroSession(createPomodoroConfig({ cycles: 1 })),
    });

    ({ task } = tickOnce(task));
    const afterWork = tickOnce(task);
    task = afterWork.task;
    expect(afterWork.audioEvents).toEqual(['workFinished', 'longBreakStarted']);
    expect(task.pomodoroSession).toMatchObject({
      phase: 'longBreak',
      cycleIndex: 1,
      completedWorkCycles: 1,
      completedShortBreaks: 0,
      remainingSec: 2,
    });

    ({ task } = tickOnce(task));
    const finished = tickOnce(task);
    task = finished.task;
    expect(finished.audioEvents).toEqual(['longBreakFinished', 'pomodoroSessionFinished']);
    expect(task.timerStatus).toBe('expired');
    expect(task.pomodoroSession).toMatchObject({ phase: 'longBreak', remainingSec: 0 });
  });

  test('pause and resume preserve the active pomodoro phase and remaining time', () => {
    const baseConfig = createPomodoroConfig({ cycles: 4, workDurationSec: 1500, shortBreakDurationSec: 300, longBreakDurationSec: 900 });
    const phaseCases: Array<{ label: string; session: PomodoroSessionState }> = [
      {
        label: 'work',
        session: {
          phase: 'work',
          cycleIndex: 2,
          totalCycles: 4,
          completedWorkCycles: 1,
          completedShortBreaks: 1,
          currentPhaseDurationSec: 1500,
          remainingSec: 1200,
        },
      },
      {
        label: 'short break',
        session: {
          phase: 'shortBreak',
          cycleIndex: 1,
          totalCycles: 4,
          completedWorkCycles: 1,
          completedShortBreaks: 0,
          currentPhaseDurationSec: 300,
          remainingSec: 180,
        },
      },
      {
        label: 'long break',
        session: {
          phase: 'longBreak',
          cycleIndex: 4,
          totalCycles: 4,
          completedWorkCycles: 4,
          completedShortBreaks: 3,
          currentPhaseDurationSec: 900,
          remainingSec: 420,
        },
      },
    ];

    for (const phaseCase of phaseCases) {
      const task = createPomodoroTask({
        pomodoro: baseConfig,
        pomodoroSession: phaseCase.session,
        remainingSec: phaseCase.session.remainingSec,
        originalDurationSec: phaseCase.session.currentPhaseDurationSec,
        timerStatus: 'running',
      });

      const paused = applyTimerPatch(task, toggleTimerState(task, NOW_ISO));
      expect(paused.timerStatus).toBe('paused');
      expect(paused.pomodoroSession).toEqual(phaseCase.session);
      expect(paused.remainingSec).toBe(phaseCase.session.remainingSec);

      const resumed = applyTimerPatch(paused, toggleTimerState(paused, NOW_ISO));
      expect(resumed.timerStatus).toBe('running');
      expect(resumed.pomodoroSession).toEqual(phaseCase.session);
      expect(resumed.remainingSec).toBe(phaseCase.session.remainingSec);
    }
  });

  test('reset returns pomodoro to work 1 with the full work duration', () => {
    const pomodoro = createPomodoroConfig({ cycles: 4, workDurationSec: 1500, shortBreakDurationSec: 300, longBreakDurationSec: 900 });
    const task = createPomodoroTask({
      pomodoro,
      pomodoroSession: {
        phase: 'shortBreak',
        cycleIndex: 2,
        totalCycles: 4,
        completedWorkCycles: 2,
        completedShortBreaks: 1,
        currentPhaseDurationSec: 300,
        remainingSec: 120,
      },
      remainingSec: 120,
      originalDurationSec: 300,
      timerStatus: 'paused',
    });

    const resetTask = applyTimerPatch(task, resetTimerState(task, NOW_ISO));
    expect(resetTask.timerStatus).toBe('idle');
    expect(resetTask.remainingSec).toBe(1500);
    expect(resetTask.originalDurationSec).toBe(1500);
    expect(resetTask.pomodoroSession).toMatchObject({
      phase: 'work',
      cycleIndex: 1,
      totalCycles: 4,
      completedWorkCycles: 0,
      completedShortBreaks: 0,
      currentPhaseDurationSec: 1500,
      remainingSec: 1500,
    });
  });

  test('derives compact timer display meta without pushing phase logic into the UI', () => {
    const baseSettings = {
      doubleClickRestartEnabled: testSettings.general.doubleClickRestartEnabled,
      autoStartAfterDoubleClickRestart: testSettings.general.autoStartAfterDoubleClickRestart,
    };

    const durationVm = getTaskRowViewModel(createPomodoroTask({
      id: 'duration',
      title: 'Duration task',
      timerMode: 'duration',
      pomodoro: undefined,
      pomodoroSession: undefined,
      remainingSec: 1500,
      originalDurationSec: 1500,
      timerStatus: 'idle',
    }), {
      showUrgencyIndicator: true,
      timerBehaviorSettings: baseSettings,
    });
    expect(durationVm.timerDisplay).toEqual({
      displayTime: '25m',
      tone: 'neutral',
      isPomodoro: false,
    });

    const idlePomodoro = createPomodoroTask({
      id: 'idle-pomodoro',
      title: 'Idle pomodoro',
      timerStatus: 'idle',
      pomodoro: createPomodoroConfig({
        cycles: 10,
        workDurationSec: 25 * 60,
        shortBreakDurationSec: 5 * 60,
        longBreakDurationSec: 15 * 60,
        workDurationMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
      }),
      pomodoroSession: createInitialPomodoroSession(createPomodoroConfig({
        cycles: 10,
        workDurationSec: 25 * 60,
        shortBreakDurationSec: 5 * 60,
        longBreakDurationSec: 15 * 60,
        workDurationMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
      })),
      remainingSec: 25 * 60,
      originalDurationSec: 25 * 60,
    });
    const idleVm = getTaskRowViewModel(idlePomodoro, {
      showUrgencyIndicator: true,
      timerBehaviorSettings: baseSettings,
    });
    expect(idleVm.timerDisplay).toEqual({
      displayTime: '10×25m',
      tone: 'neutral',
      isPomodoro: true,
    });

    const workSession: PomodoroSessionState = {
      phase: 'work',
      cycleIndex: 1,
      totalCycles: 10,
      completedWorkCycles: 0,
      completedShortBreaks: 0,
      currentPhaseDurationSec: 1500,
      remainingSec: 1452,
    };
    const workDisplay = getPomodoroDisplayMeta(workSession, idlePomodoro.pomodoro!);
    expect(workDisplay).toEqual({
      displayTime: '24:12',
      displayMeta: '1/10',
      phase: 'work',
      tone: 'focus',
      isPomodoro: true,
    });

    const shortBreakDisplay = getPomodoroDisplayMeta({
      phase: 'shortBreak',
      cycleIndex: 1,
      totalCycles: 10,
      completedWorkCycles: 1,
      completedShortBreaks: 0,
      currentPhaseDurationSec: 300,
      remainingSec: 252,
    }, idlePomodoro.pomodoro!);
    expect(shortBreakDisplay).toEqual({
      displayTime: '04:12',
      displayMeta: 'B1',
      phase: 'shortBreak',
      tone: 'break',
      isPomodoro: true,
    });

    const longBreakDisplay = getPomodoroDisplayMeta({
      phase: 'longBreak',
      cycleIndex: 10,
      totalCycles: 10,
      completedWorkCycles: 10,
      completedShortBreaks: 9,
      currentPhaseDurationSec: 15 * 60,
      remainingSec: 14 * 60 + 12,
    }, idlePomodoro.pomodoro!);
    expect(longBreakDisplay).toEqual({
      displayTime: '14:12',
      displayMeta: 'LB',
      phase: 'longBreak',
      tone: 'longBreak',
      isPomodoro: true,
    });
  });
});

test.describe('Pomodoro task row UI', () => {
  test('renders compact configured and phase-aware pomodoro timer pills without long inline labels', async ({ page }) => {
    const tasks: StoredTask[] = [
      createStoredPomodoroTask({
        id: 'duration-ui',
        title: 'Regular duration task',
        timerMode: 'duration',
        pomodoro: undefined,
        pomodoroSession: undefined,
        remainingSec: 1500,
        originalDurationSec: 1500,
        timerStatus: 'idle',
      }),
      createStoredPomodoroTask({
        id: 'configured-ui',
        title: 'Configured pomodoro task',
        timerStatus: 'idle',
      }),
      createStoredPomodoroTask({
        id: 'work-ui',
        title: 'Work phase pomodoro task',
        timerStatus: 'running',
        pomodoroSession: {
          phase: 'work',
          cycleIndex: 1,
          totalCycles: 10,
          completedWorkCycles: 0,
          completedShortBreaks: 0,
          currentPhaseDurationSec: 1500,
          remainingSec: 1452,
        },
        remainingSec: 1452,
        originalDurationSec: 1500,
      }),
      createStoredPomodoroTask({
        id: 'short-ui',
        title: 'Short break pomodoro task',
        timerStatus: 'running',
        pomodoroSession: {
          phase: 'shortBreak',
          cycleIndex: 1,
          totalCycles: 10,
          completedWorkCycles: 1,
          completedShortBreaks: 0,
          currentPhaseDurationSec: 300,
          remainingSec: 252,
        },
        remainingSec: 252,
        originalDurationSec: 300,
      }),
      createStoredPomodoroTask({
        id: 'long-ui',
        title: 'Long break pomodoro task',
        timerStatus: 'running',
        pomodoroSession: {
          phase: 'longBreak',
          cycleIndex: 10,
          totalCycles: 10,
          completedWorkCycles: 10,
          completedShortBreaks: 9,
          currentPhaseDurationSec: 900,
          remainingSec: 852,
        },
        remainingSec: 852,
        originalDurationSec: 900,
      }),
    ];

    await gotoSeededPage(page, tasks, testSettings);

    const durationRow = taskRow(page, 'Regular duration task');
    await expect(durationRow.getByTestId('task-timer-cluster')).toContainText('25m');
    await expect(durationRow.getByTestId('task-timer-meta')).toHaveCount(0);

    const configuredRow = taskRow(page, 'Configured pomodoro task');
    const configuredCluster = configuredRow.getByTestId('task-timer-cluster');
    await expect(configuredCluster).toContainText('10×25m');
    await expect(configuredRow.getByTestId('task-timer-meta')).toHaveCount(0);
    await expect(configuredCluster.getByText(/Work\s+1\/10/i)).toHaveCount(0);

    const workRow = taskRow(page, 'Work phase pomodoro task');
    const workCluster = workRow.getByTestId('task-timer-cluster');
    await expect(workCluster).toContainText('24:12');
    await expect(workRow.getByTestId('task-timer-meta')).toHaveText('1/10');
    await expect(workCluster.getByText(/Work\s+1\/10/i)).toHaveCount(0);
    const workClusterBox = await workCluster.boundingBox();
    expect(workClusterBox).not.toBeNull();
    expect(workClusterBox?.height ?? 0).toBeLessThan(36);

    const shortBreakRow = taskRow(page, 'Short break pomodoro task');
    const shortBreakCluster = shortBreakRow.getByTestId('task-timer-cluster');
    await expect(shortBreakCluster).toContainText('04:12');
    await expect(shortBreakRow.getByTestId('task-timer-meta')).toHaveText('B1');
    await expect(shortBreakCluster.getByText(/Short\s+break/i)).toHaveCount(0);

    const longBreakRow = taskRow(page, 'Long break pomodoro task');
    const longBreakCluster = longBreakRow.getByTestId('task-timer-cluster');
    await expect(longBreakCluster).toContainText('14:12');
    await expect(longBreakRow.getByTestId('task-timer-meta')).toHaveText('LB');
    await expect(longBreakCluster.getByText(/Long\s+break/i)).toHaveCount(0);
  });
});


