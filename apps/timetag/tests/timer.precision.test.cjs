const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { appRoot, loadTypeScriptModule } = require('./helpers/load-typescript-module.cjs');

const timerPath = path.join(appRoot, 'src', 'domain', 'timer.logic.ts');
const storePath = path.join(appRoot, 'src', 'store', 'task.store.tsx');
const { tickTimer, toggleTimerState } = loadTypeScriptModule(timerPath);
const { taskReducer } = loadTypeScriptModule(storePath, {
  transformSource(source, filePath) {
    return filePath === storePath ? `${source}\nexport { taskReducer };\n` : source;
  },
});

const epoch = Date.UTC(2026, 10, 2, 12, 0, 0);
const at = (milliseconds) => new Date(epoch + milliseconds).toISOString();

function timerTask(overrides = {}) {
  return {
    id: 'precision-case',
    title: 'Precision case',
    workspace: 'work',
    status: 'active',
    timerMode: 'duration',
    remainingSec: 100,
    originalDurationSec: 100,
    timerStatus: 'idle',
    timerControls: { autoStart: false, autoPlay: false, autoReset: false, allowOverdue: false },
    reminders: [],
    createdAt: at(0),
    updatedAt: at(0),
    ...overrides,
  };
}

function stateWith(tasks = []) {
  return {
    tasks,
    workspace: 'all',
    searchQuery: '',
    selectedIds: new Set(),
    undoStack: null,
    filter: {
      status: 'active',
      urgency: { normal: true, warn: true, danger: true, overdue: true },
      approachingRed: { enabled: false, windowMinutes: 10 },
      mode: { duration: true, pomodoro: true, deadline: true },
      hasReminders: 'any',
    },
    sort: { field: 'createdAt', direction: 'desc' },
  };
}

function apply(task, patch) {
  assert.notEqual(patch, null, 'the real timer subject must produce this transition');
  return { ...task, ...patch };
}

function withFixedNow(now, action) {
  const RealDate = global.Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [now] : args));
    }

    static now() {
      return now;
    }
  }

  global.Date = FixedDate;
  try {
    return action();
  } finally {
    global.Date = RealDate;
  }
}

test('repeated 1.5-second active segments consume their full active sum and exclude paused gaps', () => {
  let current = timerTask();

  for (let segment = 0; segment < 10; segment += 1) {
    const startedAt = segment * 10_000;
    current = apply(current, toggleTimerState(current, at(startedAt)));
    current = apply(current, tickTimer(current, at(startedAt + 1_500)));
    current = apply(current, toggleTimerState(current, at(startedAt + 1_500)));
  }

  assert.deepEqual(
    { remainingSec: current.remainingSec, timerStatus: current.timerStatus },
    { remainingSec: 85, timerStatus: 'paused' },
    'ten active 1.5-second segments consume fifteen seconds; the 8.5-second gaps do not count',
  );
});

test('a positive fractional deadline remains unexpired until its exact target with either overdue policy', () => {
  for (const allowOverdue of [false, true]) {
    const deadline = timerTask({
      timerMode: 'deadline',
      targetAt: at(500),
      remainingSec: 1,
      originalDurationSec: 1,
      timerControls: { autoStart: false, autoPlay: false, autoReset: false, allowOverdue },
    });

    const beforeTargetPatch = tickTimer(deadline, at(0));
    const beforeTarget = beforeTargetPatch ? { ...deadline, ...beforeTargetPatch } : deadline;

    assert.deepEqual(
      { remainingSec: beforeTarget.remainingSec, timerStatus: beforeTarget.timerStatus },
      { remainingSec: 1, timerStatus: 'idle' },
      `positive 500ms remaining rounds up before expiry when allowOverdue=${allowOverdue}`,
    );

    const atTarget = apply(beforeTarget, tickTimer(beforeTarget, at(500)));
    assert.deepEqual(
      { remainingSec: atTarget.remainingSec, timerStatus: atTarget.timerStatus },
      { remainingSec: 0, timerStatus: 'expired' },
      `the exact target expires when allowOverdue=${allowOverdue}`,
    );
  }
});

test('an overdue fractional deadline displays a negative second when overdue is allowed', () => {
  const overdue = timerTask({
    timerMode: 'deadline',
    targetAt: at(0),
    remainingSec: 1,
    originalDurationSec: 1,
    timerControls: { autoStart: false, autoPlay: false, autoReset: false, allowOverdue: true },
  });

  const afterTarget = apply(overdue, tickTimer(overdue, at(500)));

  assert.deepEqual(
    { remainingSec: afterTarget.remainingSec, timerStatus: afterTarget.timerStatus },
    { remainingSec: -1, timerStatus: 'expired' },
  );
});

test('creating a deadline with a future fractional target starts at one remaining second', () => {
  const created = withFixedNow(epoch, () => taskReducer(stateWith(), {
    type: 'ADD_TASK',
    payload: { title: 'Future fraction', timerMode: 'deadline', targetAt: at(500) },
  }).tasks[0]);

  assert.deepEqual(
    { remainingSec: created.remainingSec, originalDurationSec: created.originalDurationSec, timerStatus: created.timerStatus },
    { remainingSec: 1, originalDurationSec: 1, timerStatus: 'idle' },
  );
});
