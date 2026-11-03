const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { appRoot, loadTypeScriptModule } = require('./helpers/load-typescript-module.cjs');

const subjectPath = path.join(appRoot, 'src', 'domain', 'timer.logic.ts');
const { shouldTickTimer } = loadTypeScriptModule(subjectPath);

const at = (second) => new Date(Date.UTC(2026, 10, 2, 12, 0, second)).toISOString();

function task(overrides = {}) {
  return {
    id: 'scheduler-case',
    title: 'Scheduler case',
    workspace: 'work',
    status: 'active',
    timerMode: 'duration',
    remainingSec: 100,
    originalDurationSec: 100,
    timerStatus: 'idle',
    timerControls: {
      autoStart: false,
      autoPlay: false,
      autoReset: false,
      allowOverdue: false,
    },
    reminders: [],
    createdAt: at(0),
    updatedAt: at(0),
    ...overrides,
  };
}

test('does not schedule running auto-start deadlines without a valid target', () => {
  const missingTarget = task({
    timerMode: 'deadline',
    timerStatus: 'running',
    timerControls: { autoStart: true, autoPlay: false, autoReset: false, allowOverdue: false },
  });
  const invalidTarget = { ...missingTarget, targetAt: 'not-an-iso-date' };

  assert.equal(shouldTickTimer(missingTarget), false);
  assert.equal(shouldTickTimer(invalidTarget), false);
});

test('schedules active deadlines with a valid target across idle, paused, and running states', () => {
  const base = task({ timerMode: 'deadline', targetAt: at(90) });

  for (const timerStatus of ['idle', 'paused', 'running']) {
    assert.equal(shouldTickTimer({ ...base, timerStatus }), true, timerStatus);
  }
});

test('stops expired deadlines unless overdue time is allowed', () => {
  const expired = task({
    timerMode: 'deadline',
    targetAt: at(0),
    timerStatus: 'expired',
  });
  const overdueAllowed = {
    ...expired,
    timerControls: { ...expired.timerControls, allowOverdue: true },
  };

  assert.equal(shouldTickTimer(expired), false);
  assert.equal(shouldTickTimer(overdueAllowed), true);
});

test('does not schedule inactive deadlines even when their target is valid', () => {
  const inactive = task({
    timerMode: 'deadline',
    status: 'done',
    targetAt: at(90),
    timerStatus: 'running',
    timerControls: { autoStart: true, autoPlay: false, autoReset: false, allowOverdue: true },
  });

  assert.equal(shouldTickTimer(inactive), false);
});

test('schedules duration timers only while they are running', () => {
  for (const timerStatus of ['idle', 'paused']) {
    assert.equal(shouldTickTimer(task({ timerStatus })), false, timerStatus);
  }

  assert.equal(shouldTickTimer(task({ timerStatus: 'running' })), true);
});
