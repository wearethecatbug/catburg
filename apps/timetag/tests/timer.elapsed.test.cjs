const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { appRoot, loadTypeScriptModule } = require('./helpers/load-typescript-module.cjs');

const subjectPath = path.join(appRoot, 'src', 'domain', 'timer.logic.ts');

const { tickTimer, toggleTimerState, resetTimerState } = loadTypeScriptModule(subjectPath);

const at = (second) => new Date(Date.UTC(2026, 10, 2, 12, 0, second)).toISOString();

function task(overrides = {}) {
  return {
    id: 'timer-case',
    title: 'Timer case',
    workspace: 'work',
    status: 'active',
    timerMode: 'duration',
    remainingSec: 100,
    originalDurationSec: 100,
    timerStatus: 'running',
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

function apply(taskValue, patch) {
  assert.notEqual(patch, null, 'the real timer subject must return a transition');
  return { ...taskValue, ...patch };
}

test('deadline derives remaining time while idle instead of requiring a running tick', () => {
  const idleDeadline = task({
    timerMode: 'deadline',
    targetAt: at(90),
    timerStatus: 'idle',
    remainingSec: 1,
    originalDurationSec: 1,
  });

  const afterReload = apply(idleDeadline, tickTimer(idleDeadline, at(30)));

  assert.equal(afterReload.remainingSec, 60);
  assert.equal(afterReload.timerStatus, 'idle');
});

test('deadline expires at zero and exposes negative overdue time when overdue is allowed', () => {
  const expires = task({
    timerMode: 'deadline',
    targetAt: at(10),
    timerStatus: 'idle',
    remainingSec: 99,
    timerControls: { autoStart: false, autoPlay: false, autoReset: false, allowOverdue: false },
  });
  const overdue = {
    ...expires,
    timerControls: { ...expires.timerControls, allowOverdue: true },
  };

  const expired = apply(expires, tickTimer(expires, at(11)));
  const overdueResult = apply(overdue, tickTimer(overdue, at(75)));

  assert.deepEqual(
    { remainingSec: expired.remainingSec, timerStatus: expired.timerStatus },
    { remainingSec: 0, timerStatus: 'expired' },
  );
  assert.deepEqual(
    { remainingSec: overdueResult.remainingSec, timerStatus: overdueResult.timerStatus },
    { remainingSec: -65, timerStatus: 'expired' },
  );
});

test('duration deducts delayed elapsed seconds once and retains the sub-second remainder', () => {
  const running = task({ lastTimerUpdateAt: '2026-11-02T12:00:00.500Z' });

  const afterDelay = apply(running, tickTimer(running, '2026-11-02T12:00:37.200Z'));
  const repeatedPatch = tickTimer(afterDelay, '2026-11-02T12:00:37.200Z');
  const repeatedNow = repeatedPatch ? apply(afterDelay, repeatedPatch) : afterDelay;
  const nextWholeSecond = apply(repeatedNow, tickTimer(repeatedNow, '2026-11-02T12:00:37.500Z'));

  assert.equal(afterDelay.remainingSec, 64);
  assert.equal(repeatedPatch, null);
  assert.equal(repeatedNow.remainingSec, 64);
  assert.equal(nextWholeSecond.remainingSec, 63);
});

test('pause reconciles elapsed time, resume establishes a new anchor, and reset clears it', () => {
  const running = task({ lastTimerUpdateAt: at(0) });
  const paused = apply(running, toggleTimerState(running, at(10)));
  const resumed = apply(paused, toggleTimerState(paused, at(30)));
  const elapsedAfterResume = apply(resumed, tickTimer(resumed, at(35)));
  const reset = apply(elapsedAfterResume, resetTimerState(elapsedAfterResume, at(36)));

  assert.deepEqual(
    { remainingSec: paused.remainingSec, timerStatus: paused.timerStatus, lastTimerUpdateAt: paused.lastTimerUpdateAt },
    { remainingSec: 90, timerStatus: 'paused', lastTimerUpdateAt: undefined },
  );
  assert.deepEqual(
    { remainingSec: elapsedAfterResume.remainingSec, timerStatus: elapsedAfterResume.timerStatus },
    { remainingSec: 85, timerStatus: 'running' },
  );
  assert.deepEqual(
    { remainingSec: reset.remainingSec, timerStatus: reset.timerStatus, lastTimerUpdateAt: reset.lastTimerUpdateAt },
    { remainingSec: 100, timerStatus: 'idle', lastTimerUpdateAt: undefined },
  );
});

test('duration auto-reset consumes every crossed cycle instead of resetting only once', () => {
  const repeating = task({
    remainingSec: 10,
    originalDurationSec: 10,
    lastTimerUpdateAt: at(0),
    timerControls: { autoStart: false, autoPlay: false, autoReset: true, allowOverdue: false },
  });

  const afterThirtyFiveSeconds = apply(repeating, tickTimer(repeating, at(35)));

  assert.deepEqual(
    { remainingSec: afterThirtyFiveSeconds.remainingSec, timerStatus: afterThirtyFiveSeconds.timerStatus },
    { remainingSec: 5, timerStatus: 'running' },
  );
});

test('a legacy running duration without an anchor adopts now without resetting or subtracting time', () => {
  const legacy = task({ remainingSec: 74, originalDurationSec: 120 });
  delete legacy.lastTimerUpdateAt;

  const adopted = apply(legacy, tickTimer(legacy, at(45)));

  assert.deepEqual(
    { remainingSec: adopted.remainingSec, timerStatus: adopted.timerStatus, lastTimerUpdateAt: adopted.lastTimerUpdateAt },
    { remainingSec: 74, timerStatus: 'running', lastTimerUpdateAt: at(45) },
  );
});
