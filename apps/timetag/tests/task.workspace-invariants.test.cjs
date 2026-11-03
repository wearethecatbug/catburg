const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { appRoot, loadTypeScriptModule } = require('./helpers/load-typescript-module.cjs');

const storePath = path.join(appRoot, 'src', 'store', 'task.store.tsx');
const pipelinePath = path.join(appRoot, 'src', 'domain', 'task.pipeline.ts');
const { taskReducer } = loadTypeScriptModule(storePath, {
  transformSource(source, filePath) {
    return filePath === storePath ? `${source}\nexport { taskReducer };\n` : source;
  },
});
const { applyPipeline } = loadTypeScriptModule(pipelinePath);

const epoch = Date.UTC(2026, 10, 3, 12, 0, 0);
const at = (second) => new Date(epoch + second * 1_000).toISOString();

function task(id, overrides = {}) {
  return {
    id,
    title: id,
    workspace: 'work',
    status: 'active',
    timerMode: 'duration',
    remainingSec: 300,
    originalDurationSec: 300,
    timerStatus: 'idle',
    timerControls: { autoStart: false, autoPlay: false, autoReset: false, allowOverdue: false },
    reminders: [],
    createdAt: at(0),
    updatedAt: at(0),
    ...overrides,
  };
}

function stateWith(tasks, selectedIds = []) {
  return {
    tasks,
    workspace: 'all',
    searchQuery: '',
    selectedIds: new Set(selectedIds),
    undoStack: null,
    filter: {
      status: 'all',
      urgency: { normal: true, warn: true, danger: true, overdue: true },
      approachingRed: { enabled: false, windowMinutes: 10 },
      mode: { duration: true, pomodoro: true, deadline: true },
      hasReminders: 'any',
    },
    sort: { field: 'title', direction: 'asc' },
  };
}

function query(workspace) {
  return {
    ...stateWith([]),
    workspace,
  };
}

function withFixedNow(action) {
  const RealDate = global.Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [epoch] : args));
    }

    static now() {
      return epoch;
    }
  }

  global.Date = FixedDate;
  try {
    return action();
  } finally {
    global.Date = RealDate;
  }
}

test('an active single task starts normally', () => {
  const beforeTask = task('active-single', { timerStatus: 'idle' });
  const after = taskReducer(stateWith([beforeTask]), {
    type: 'TOGGLE_TIMER',
    payload: { id: beforeTask.id, nowIso: at(1) },
  });

  assert.equal(after.tasks[0].timerStatus, 'running');
});

for (const status of ['done', 'archived']) {
  test(`a stale single-task start leaves a ${status} task non-running`, () => {
    const beforeTask = task(`${status}-single`, { status, timerStatus: 'idle' });
    const after = taskReducer(stateWith([beforeTask]), {
      type: 'TOGGLE_TIMER',
      payload: { id: beforeTask.id, nowIso: at(1) },
    });

    assert.equal(after.tasks[0].timerStatus, 'idle', `${status} task must ignore a stale single start`);
    assert.equal(after.tasks[0].updatedAt, at(0), `${status} task must not receive a timer update`);
  });
}

test('bulk play starts an active paused task but ignores stale done and archived selections', () => {
  const active = task('active', { timerStatus: 'paused' });
  const done = task('done', { status: 'done', timerStatus: 'paused' });
  const archived = task('archived', { status: 'archived', timerStatus: 'idle' });

  const after = taskReducer(stateWith([active, done, archived], [active.id, done.id, archived.id]), {
    type: 'PLAY_SELECTED',
    payload: { nowIso: at(1) },
  });
  const byId = new Map(after.tasks.map((item) => [item.id, item]));

  assert.equal(byId.get(active.id).timerStatus, 'running', 'active task remains playable');
  assert.equal(byId.get(done.id).timerStatus, 'paused', 'done task ignores stale bulk play');
  assert.equal(byId.get(archived.id).timerStatus, 'idle', 'archived task ignores stale bulk play');
});

test('creating from the All workspace uses the established work workspace default', () => {
  const created = withFixedNow(() => taskReducer(stateWith([]), {
    type: 'ADD_TASK',
    payload: { title: 'Created from All', workspace: 'all' },
  }).tasks[0]);

  assert.equal(created.workspace, 'work');
});

test('All, Work, and Home filters keep a legacy all task visible only through All without rewriting it', () => {
  const work = task('Work', { workspace: 'work' });
  const home = task('Home', { workspace: 'home' });
  const legacyAll = task('Legacy all', { workspace: 'all' });
  const tasks = [work, home, legacyAll];
  const legacySnapshot = JSON.stringify(legacyAll);

  assert.deepEqual(applyPipeline(tasks, query('all')).map((item) => item.id), ['Home', 'Legacy all', 'Work']);
  assert.deepEqual(applyPipeline(tasks, query('work')).map((item) => item.id), ['Work']);
  assert.deepEqual(applyPipeline(tasks, query('home')).map((item) => item.id), ['Home']);

  const afterWorkspaceSwitch = taskReducer(stateWith(tasks), { type: 'SET_WORKSPACE', payload: 'work' });
  assert.equal(JSON.stringify(afterWorkspaceSwitch.tasks.find((item) => item.id === legacyAll.id)), legacySnapshot);
});
