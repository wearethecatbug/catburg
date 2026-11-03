const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { appRoot, loadTypeScriptModule } = require('./helpers/load-typescript-module.cjs');

const timerPath = path.join(appRoot, 'src', 'domain', 'timer.logic.ts');
const storePath = path.join(appRoot, 'src', 'store', 'task.store.tsx');
const { tickTimer, toggleTimerState, resetTimerState } = loadTypeScriptModule(timerPath);
const { taskReducer } = loadTypeScriptModule(storePath, {
  transformSource(source, filePath) {
    return filePath === storePath ? `${source}\nexport { taskReducer };\n` : source;
  },
});

const epoch = Date.UTC(2026, 10, 2, 12, 0, 0);
const at = (milliseconds) => new Date(epoch + milliseconds).toISOString();

function pomodoroTask(overrides = {}) {
  return {
    id: 'pomodoro-case',
    title: 'Pomodoro case',
    workspace: 'work',
    status: 'active',
    timerMode: 'pomodoro',
    remainingSec: 60,
    originalDurationSec: 60,
    timerStatus: 'running',
    lastTimerUpdateAt: at(0),
    timerControls: { autoStart: false, autoPlay: false, autoReset: false, allowOverdue: false },
    pomodoro: {
      cycles: 1,
      workDurationMin: 1,
      shortBreakMin: 2,
      longBreakMin: 3,
      currentCycle: 0,
      isBreak: false,
    },
    reminders: [],
    createdAt: at(0),
    updatedAt: at(0),
    ...overrides,
  };
}

function apply(task, patch) {
  assert.notEqual(patch, null, 'the real timer subject must produce a transition');
  return { ...task, ...patch };
}

function phase(task) {
  return {
    remainingSec: task.remainingSec,
    timerStatus: task.timerStatus,
    status: task.status,
    currentCycle: task.pomodoro?.currentCycle,
    isBreak: task.pomodoro?.isBreak,
  };
}

function tickAfter(task, elapsedMs) {
  const anchor = new Date(task.lastTimerUpdateAt).getTime();
  return apply(task, tickTimer(task, new Date(anchor + elapsedMs).toISOString()));
}

function stateWith(tasks = []) {
  return {
    tasks,
    workspace: 'all',
    searchQuery: '',
    selectedIds: new Set(),
    undoStack: null,
    filter: {
      status: 'active', urgency: { normal: true, warn: true, danger: true, overdue: true },
      approachingRed: { enabled: false, windowMinutes: 10 }, mode: { duration: true, pomodoro: true, deadline: true }, hasReminders: 'any',
    },
    sort: { field: 'createdAt', direction: 'desc' },
  };
}

function withFixedNow(now, action) {
  const RealDate = global.Date;
  class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length === 0 ? [now] : args)); }
    static now() { return now; }
  }
  global.Date = FixedDate;
  try { return action(); } finally { global.Date = RealDate; }
}

test('N1 migrates legacy phase fields into work, short break, then terminal expiry without changing business status', () => {
  const legacy = pomodoroTask({ pomodoro: { cycles: 1, workDurationMin: 1, shortBreakMin: 2, longBreakMin: 3 } });
  const shortBreak = tickAfter(legacy, 60_000);

  assert.deepEqual(phase(shortBreak), {
    remainingSec: 120, timerStatus: 'running', status: 'active', currentCycle: 1, isBreak: true,
  });
  const terminal = tickAfter(shortBreak, 120_000);
  assert.deepEqual(phase(terminal), {
    remainingSec: 0, timerStatus: 'expired', status: 'active', currentCycle: 1, isBreak: true,
  });
});

test('N4 selects three short breaks and a long final break before terminal expiry', () => {
  let current = pomodoroTask({ pomodoro: { cycles: 4, workDurationMin: 1, shortBreakMin: 2, longBreakMin: 3, currentCycle: 0, isBreak: false } });
  const expectedBreakDurations = [120, 120, 120, 180];

  for (let work = 1; work <= 4; work += 1) {
    current = tickAfter(current, 60_000);
    assert.deepEqual(phase(current), {
      remainingSec: expectedBreakDurations[work - 1], timerStatus: 'running', status: 'active', currentCycle: work, isBreak: true,
    });
    current = tickAfter(current, current.remainingSec * 1_000);

    if (work < 4) {
      assert.deepEqual(phase(current), {
        remainingSec: 60, timerStatus: 'running', status: 'active', currentCycle: work, isBreak: false,
      });
    }
  }

  assert.deepEqual(phase(current), {
    remainingSec: 0, timerStatus: 'expired', status: 'active', currentCycle: 4, isBreak: true,
  });
});

test('N5 reconciles delayed boundaries through long break, final short break, and terminal expiry', () => {
  const initial = pomodoroTask({ pomodoro: { cycles: 5, workDurationMin: 1, shortBreakMin: 2, longBreakMin: 3, currentCycle: 0, isBreak: false } });
  const afterThreeWorks = apply(initial, tickTimer(initial, at(420_000)));

  assert.deepEqual(phase(afterThreeWorks), {
    remainingSec: 120, timerStatus: 'running', status: 'active', currentCycle: 3, isBreak: true,
  });
  const longBreak = apply(afterThreeWorks, tickTimer(afterThreeWorks, at(600_000)));
  assert.deepEqual(phase(longBreak), {
    remainingSec: 180, timerStatus: 'running', status: 'active', currentCycle: 4, isBreak: true,
  });
  const finalWorkPartway = apply(longBreak, tickTimer(longBreak, at(810_000)));
  assert.deepEqual(phase(finalWorkPartway), {
    remainingSec: 30, timerStatus: 'running', status: 'active', currentCycle: 4, isBreak: false,
  });
  const finalBreak = apply(finalWorkPartway, tickTimer(finalWorkPartway, at(840_000)));
  assert.deepEqual(phase(finalBreak), {
    remainingSec: 120, timerStatus: 'running', status: 'active', currentCycle: 5, isBreak: true,
  });
  const terminal = apply(finalBreak, tickTimer(finalBreak, at(960_000)));
  assert.deepEqual(phase(terminal), {
    remainingSec: 0, timerStatus: 'expired', status: 'active', currentCycle: 5, isBreak: true,
  });
});

test('serialized break state resumes with fractional active carry, ignores paused wall time, and reset returns first work', () => {
  const breakState = pomodoroTask({
    remainingSec: 120,
    originalDurationSec: 120,
    lastTimerUpdateAt: at(0),
    pomodoro: { cycles: 5, workDurationMin: 1, shortBreakMin: 2, longBreakMin: 3, currentCycle: 1, isBreak: true },
  });
  const afterFraction = apply(breakState, tickTimer(breakState, at(1_500)));
  const paused = apply(afterFraction, toggleTimerState(afterFraction, at(1_500)));
  const reloaded = JSON.parse(JSON.stringify(paused));
  const resumed = apply(reloaded, toggleTimerState(reloaded, at(10_000)));
  const afterResume = apply(resumed, tickTimer(resumed, at(10_500)));
  const reset = apply(afterResume, resetTimerState(afterResume, at(11_000)));

  assert.deepEqual(phase(afterResume), {
    remainingSec: 118, timerStatus: 'running', status: 'active', currentCycle: 1, isBreak: true,
  });
  assert.deepEqual(phase(reset), {
    remainingSec: 60, timerStatus: 'idle', status: 'active', currentCycle: 0, isBreak: false,
  });
});

test('Pomodoro auto-start creates only the initial work phase', () => {
  const created = withFixedNow(epoch, () => taskReducer(stateWith(), {
    type: 'ADD_TASK',
    payload: {
      title: 'Auto work only', timerMode: 'pomodoro', durationSec: 60,
      timerControls: { autoStart: true, autoPlay: false, autoReset: false, allowOverdue: false },
      pomodoro: { cycles: 4, workDurationMin: 1, shortBreakMin: 2, longBreakMin: 3, autoStart: true, autoPlay: false },
    },
  }).tasks[0]);

  assert.deepEqual(phase(created), {
    remainingSec: 60, timerStatus: 'running', status: 'active', currentCycle: 0, isBreak: false,
  });
});
