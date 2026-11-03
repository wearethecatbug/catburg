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

const at = (second) => new Date(Date.UTC(2026, 10, 2, 12, 0, second)).toISOString();

function task(overrides = {}) {
  return {
    id: 'lifecycle-case',
    title: 'Lifecycle case',
    workspace: 'work',
    status: 'active',
    timerMode: 'pomodoro',
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

function stateWith(timerTask, selectedIds = []) {
  return {
    tasks: [timerTask], workspace: 'all', searchQuery: '', selectedIds: new Set(selectedIds), undoStack: null,
    filter: { status: 'active', urgency: { normal: true, warn: true, danger: true, overdue: true }, approachingRed: { enabled: false, windowMinutes: 10 }, mode: { duration: true, pomodoro: true, deadline: true }, hasReminders: 'any' },
    sort: { field: 'createdAt', direction: 'desc' },
  };
}

function apply(timerTask, patch) {
  return { ...timerTask, ...patch };
}

test('a manually started and resumed Pomodoro counts elapsed wall time before delayed ticks', () => {
  const started = apply(task(), toggleTimerState(task(), at(0)));
  const afterFirstDelay = apply(started, tickTimer(started, at(5)));
  const paused = apply(afterFirstDelay, toggleTimerState(afterFirstDelay, at(10)));
  const resumed = apply(paused, toggleTimerState(paused, at(30)));
  const afterResumeDelay = apply(resumed, tickTimer(resumed, at(35)));

  assert.deepEqual(
    { remainingSec: afterFirstDelay.remainingSec, timerStatus: afterFirstDelay.timerStatus },
    { remainingSec: 95, timerStatus: 'running' },
    'start establishes the elapsed-time anchor for Pomodoro',
  );
  assert.deepEqual(
    { remainingSec: afterResumeDelay.remainingSec, timerStatus: afterResumeDelay.timerStatus },
    { remainingSec: 85, timerStatus: 'running' },
    'resume establishes a fresh anchor without restoring paused time',
  );
});

test('an already-expired timer remains expired through done and archive transitions', () => {
  const expired = task({ timerMode: 'duration', timerStatus: 'expired', remainingSec: 0 });
  const done = taskReducer(stateWith(expired), {
    type: 'UPDATE_TASK', payload: { id: expired.id, updates: { status: 'done' }, nowIso: at(11) },
  });
  const archived = taskReducer(done, {
    type: 'UPDATE_TASK', payload: { id: expired.id, updates: { status: 'archived' }, nowIso: at(12) },
  });

  assert.deepEqual(
    { status: done.tasks[0].status, timerStatus: done.tasks[0].timerStatus, remainingSec: done.tasks[0].remainingSec },
    { status: 'done', timerStatus: 'expired', remainingSec: 0 },
  );
  assert.deepEqual(
    { status: archived.tasks[0].status, timerStatus: archived.tasks[0].timerStatus, remainingSec: archived.tasks[0].remainingSec },
    { status: 'archived', timerStatus: 'expired', remainingSec: 0 },
  );
});

test('bulk done and archive retain expired timer state while clearing the selection', () => {
  const expired = task({ timerMode: 'duration', timerStatus: 'expired', remainingSec: 0 });
  const bulkDone = taskReducer(stateWith(expired, [expired.id]), {
    type: 'MARK_DONE_SELECTED', payload: { nowIso: at(11) },
  });
  const bulkArchive = taskReducer(stateWith(expired, [expired.id]), {
    type: 'ARCHIVE_SELECTED', payload: { nowIso: at(12) },
  });

  assert.deepEqual(
    { status: bulkDone.tasks[0].status, timerStatus: bulkDone.tasks[0].timerStatus, remainingSec: bulkDone.tasks[0].remainingSec, selected: bulkDone.selectedIds.size },
    { status: 'done', timerStatus: 'expired', remainingSec: 0, selected: 0 },
  );
  assert.deepEqual(
    { status: bulkArchive.tasks[0].status, timerStatus: bulkArchive.tasks[0].timerStatus, remainingSec: bulkArchive.tasks[0].remainingSec, selected: bulkArchive.selectedIds.size },
    { status: 'archived', timerStatus: 'expired', remainingSec: 0, selected: 0 },
  );
});
