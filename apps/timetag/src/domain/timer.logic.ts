import { Task } from './task.types';

// ============================================================================
// Timer State Machine (pure, deterministic)
// ============================================================================

export type TimerEvent = 'toggle' | 'reset' | 'tick';

export function getDeadlineRemainingSec(
  targetAt: string | undefined,
  nowIso: string,
  allowOverdue: boolean,
): number | null {
  const target = targetAt ? new Date(targetAt).getTime() : Number.NaN;
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;

  const secondsUntilTarget = (target - now) / 1000;
  const remainingSec = secondsUntilTarget > 0
    ? Math.ceil(secondsUntilTarget)
    : Math.floor(secondsUntilTarget);

  return allowOverdue ? remainingSec : Math.max(0, remainingSec);
}

function getPausedRemainderMs(nowIso: string, anchorIso: string | undefined): number {
  const now = new Date(nowIso).getTime();
  const anchor = anchorIso ? new Date(anchorIso).getTime() : Number.NaN;
  if (!Number.isFinite(now) || !Number.isFinite(anchor)) return 0;

  const remainder = Math.floor((now - anchor) % 1000);
  return Math.min(999, Math.max(0, remainder));
}

function getStoredPausedRemainderMs(remainderMs: number | undefined): number {
  if (
    typeof remainderMs !== 'number' ||
    !Number.isInteger(remainderMs) ||
    remainderMs < 0 ||
    remainderMs > 999
  ) {
    return 0;
  }
  return remainderMs;
}

function getResumeAnchor(nowIso: string, remainderMs: number): string {
  if (remainderMs === 0) return nowIso;

  const now = new Date(nowIso).getTime();
  return Number.isFinite(now) ? new Date(now - remainderMs).toISOString() : nowIso;
}

export function shouldTickTimer(task: Task): boolean {
  if (task.timerMode === 'deadline') {
    const targetAt = task.targetAt ? new Date(task.targetAt).getTime() : Number.NaN;
    return (
      task.status === 'active' &&
      Number.isFinite(targetAt) &&
      (task.timerStatus !== 'expired' || Boolean(task.timerControls?.allowOverdue))
    );
  }

  return task.timerStatus === 'running';
}

/**
 * Compute next timer state after toggle.
 * running → paused, paused/idle → running, expired → expired (no-op)
 */
export function toggleTimerState(task: Task, nowIso: string): Partial<Task> {
  if (task.timerStatus === 'expired') return {};

  if (task.timerStatus === 'running') {
    const elapsedPatch = tickTimer(task, nowIso);
    if (elapsedPatch?.timerStatus === 'expired') return elapsedPatch;

    const pausedTimerRemainderMs = task.timerMode === 'deadline'
      ? undefined
      : getPausedRemainderMs(nowIso, elapsedPatch?.lastTimerUpdateAt ?? task.lastTimerUpdateAt);

    return {
      ...elapsedPatch,
      timerStatus: 'paused',
      lastTimerUpdateAt: undefined,
      pausedTimerRemainderMs,
      updatedAt: nowIso,
    };
  }

  const pausedTimerRemainderMs = getStoredPausedRemainderMs(task.pausedTimerRemainderMs);

  return {
    timerStatus: 'running',
    lastTimerUpdateAt: task.timerMode !== 'deadline'
      ? getResumeAnchor(nowIso, pausedTimerRemainderMs)
      : undefined,
    pausedTimerRemainderMs: undefined,
    updatedAt: nowIso,
  };
}

/**
 * Reset timer to original duration.
 */
export function resetTimerState(task: Task, nowIso: string): Partial<Task> {
  return {
    remainingSec: task.originalDurationSec,
    timerStatus: 'idle',
    lastTimerUpdateAt: undefined,
    pausedTimerRemainderMs: undefined,
    updatedAt: nowIso,
  };
}

/**
 * Reconcile a timer with an injected wall clock.
 */
export function tickTimer(task: Task, nowIso: string): Partial<Task> | null {
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(now)) return null;

  if (!shouldTickTimer(task)) return null;

  if (task.timerMode === 'deadline') {
    const allowOverdue = task.timerControls?.allowOverdue ?? false;
    const remainingSec = getDeadlineRemainingSec(task.targetAt, nowIso, allowOverdue);
    if (remainingSec === null) return null;
    const timerStatus = remainingSec <= 0 ? 'expired' : task.timerStatus;

    if (remainingSec === task.remainingSec && timerStatus === task.timerStatus) return null;

    return { remainingSec, timerStatus };
  }

  if (task.timerStatus !== 'running') return null;

  const anchor = task.lastTimerUpdateAt ? new Date(task.lastTimerUpdateAt).getTime() : Number.NaN;
  if (!Number.isFinite(anchor)) {
    return { lastTimerUpdateAt: nowIso };
  }

  const elapsedSec = Math.floor((now - anchor) / 1000);
  if (elapsedSec <= 0) return null;

  const allowOverdue = task.timerControls?.allowOverdue ?? false;
  const autoReset = task.timerControls?.autoReset ?? false;
  const nextAnchor = new Date(anchor + elapsedSec * 1000).toISOString();

  if (autoReset && task.originalDurationSec > 0 && task.remainingSec > 0 && elapsedSec >= task.remainingSec) {
    const overflowSec = elapsedSec - task.remainingSec;
    return {
      remainingSec: task.originalDurationSec - (overflowSec % task.originalDurationSec),
      timerStatus: 'running',
      lastTimerUpdateAt: nextAnchor,
    };
  }

  const remainingSec = allowOverdue
    ? task.remainingSec - elapsedSec
    : Math.max(0, task.remainingSec - elapsedSec);
  const isExpired = !allowOverdue && remainingSec === 0;

  return {
    remainingSec,
    timerStatus: isExpired ? 'expired' : 'running',
    lastTimerUpdateAt: isExpired ? undefined : nextAnchor,
  };
}

export function formatMmSs(totalSec: number): string {
  const isNegative = totalSec < 0;
  const sec = Math.abs(Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Для “длительности” обычно лучше ceil, чтобы 61s не превращались в "1m" или "0m" неожиданно.
 * Если originalDurationSec у тебя всегда кратно 60 — можно оставить round.
 */
export function formatMinutes(totalSec: number): string {
  const m = Math.max(1, Math.ceil(Math.max(0, totalSec) / 60));
  return `${m}m`;
}

/**
 * Label for the “chip” in the list (like on the left screenshot):
 * - running/paused/expired: show remaining as MM:SS
 * - idle: show original duration as Xm
 */
export function getRowTimerLabel(task: Task): string {
  if (
      task.timerStatus === 'running' ||
      task.timerStatus === 'paused' ||
      task.timerStatus === 'expired'
  ) {
    return formatMmSs(task.remainingSec);
  }

  return formatMinutes(task.originalDurationSec);
}
