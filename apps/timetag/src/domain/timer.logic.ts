import { Task } from './task.types';

// ============================================================================
// Timer State Machine (pure, deterministic)
// ============================================================================

export type TimerEvent = 'toggle' | 'reset' | 'tick';

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

    return {
      ...elapsedPatch,
      timerStatus: 'paused',
      lastTimerUpdateAt: undefined,
      updatedAt: nowIso,
    };
  }

  return {
    timerStatus: 'running',
    lastTimerUpdateAt: task.timerMode !== 'deadline' ? nowIso : undefined,
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
    const target = task.targetAt ? new Date(task.targetAt).getTime() : Number.NaN;

    const allowOverdue = task.timerControls?.allowOverdue ?? false;
    const remainingSec = allowOverdue
      ? Math.floor((target - now) / 1000)
      : Math.max(0, Math.floor((target - now) / 1000));
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
