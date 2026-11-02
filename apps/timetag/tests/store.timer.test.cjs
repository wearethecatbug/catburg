const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { appRoot, loadTypeScriptModule } = require('./helpers/load-typescript-module.cjs');

const storePath = path.join(appRoot, 'src', 'store', 'task.store.tsx');
const { taskReducer } = loadTypeScriptModule(storePath, {
  transformSource(source, filePath) {
    return filePath === storePath ? `${source}\nexport { taskReducer };\n` : source;
  },
});

const at = (second) => new Date(Date.UTC(2026, 10, 2, 12, 0, second)).toISOString();

function deadline(id, timerStatus) {
  return {
    id,
    title: `Deadline ${id}`,
    workspace: 'work',
    status: 'active',
    timerMode: 'deadline',
    targetAt: at(10),
    remainingSec: 99,
    originalDurationSec: 99,
    timerStatus,
    timerControls: {
      autoStart: false,
      autoPlay: false,
      autoReset: false,
      allowOverdue: false,
    },
    reminders: [],
    createdAt: at(0),
    updatedAt: at(0),
  };
}

function stateWith(task, selectedIds = []) {
  return {
    tasks: [task],
    workspace: 'all',
    filter: {
      status: 'active',
      urgency: { normal: true, warn: true, danger: true, overdue: true },
      approachingRed: { enabled: false, windowMinutes: 10 },
      mode: { duration: true, pomodoro: true, deadline: true },
      hasReminders: 'any',
    },
    sort: { field: 'createdAt', direction: 'desc' },
    searchQuery: '',
    selectedIds: new Set(selectedIds),
    undoStack: null,
  };
}

function expectExpiredFrozen(result, expectedStatus) {
  assert.deepEqual(
    {
      status: result.status,
      remainingSec: result.remainingSec,
      timerStatus: result.timerStatus,
      lastTimerUpdateAt: result.lastTimerUpdateAt,
      updatedAt: result.updatedAt,
    },
    {
      status: expectedStatus,
      remainingSec: 0,
      timerStatus: 'expired',
      lastTimerUpdateAt: undefined,
      updatedAt: at(11),
    },
  );
}

test('UPDATE_TASK reconciles an elapsed idle deadline before marking it done', () => {
  const before = stateWith(deadline('idle-update', 'idle'));
  const after = taskReducer(before, {
    type: 'UPDATE_TASK',
    payload: { id: 'idle-update', updates: { status: 'done' }, nowIso: at(11) },
  });

  expectExpiredFrozen(after.tasks[0], 'done');
});

test('MARK_DONE_SELECTED reconciles an elapsed paused deadline before closing it', () => {
  const before = stateWith(deadline('paused-done', 'paused'), ['paused-done']);
  const after = taskReducer(before, {
    type: 'MARK_DONE_SELECTED',
    payload: { nowIso: at(11) },
  });

  expectExpiredFrozen(after.tasks[0], 'done');
  assert.equal(after.selectedIds.size, 0, 'bulk completion clears the selection');
});

test('ARCHIVE_SELECTED reconciles an elapsed idle deadline before archiving it', () => {
  const before = stateWith(deadline('idle-archive', 'idle'), ['idle-archive']);
  const after = taskReducer(before, {
    type: 'ARCHIVE_SELECTED',
    payload: { nowIso: at(11) },
  });

  expectExpiredFrozen(after.tasks[0], 'archived');
  assert.equal(after.selectedIds.size, 0, 'bulk archive clears the selection');
});
