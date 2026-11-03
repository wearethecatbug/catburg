'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PomodoroConfig, Task, TaskStatus, TimerControls, TimerMode, TimerStatus } from '@/domain/task.types';
import { shouldTickTimer } from '@/domain/timer.logic';

export const TASK_STORAGE_KEY = 'timetag-tasks';
export const TASK_RECOVERY_KEY = 'timetag-tasks-recovery';
const TASK_LOCK_NAME = TASK_STORAGE_KEY;

export type TaskPersistenceStatus =
  | { kind: 'ready' }
  | { kind: 'unsaved'; reason: 'invalid' | 'read' | 'recovery' | 'replace' | 'write'; message: string }
  | { kind: 'conflict'; message: string; localTasks: Task[]; externalTasks: Task[] }
  | { kind: 'unsupported'; message: string };

type LockManagerLike = { request<T>(name: string, callback: () => Promise<T> | T): Promise<T> };
interface DecodedTasks { tasks: Task[]; migrated: boolean }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isString(value: unknown): value is string { return typeof value === 'string'; }
function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function isIntegerIn(value: unknown, minimum: number, maximum: number): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= minimum && value <= maximum;
}
function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T { return typeof value === 'string' && values.includes(value as T); }
function isIsoTimestamp(value: unknown): value is string {
  if (!isString(value)) return false;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value;
}
function isTimerControls(value: unknown): value is TimerControls {
  return isRecord(value) && ['autoStart', 'autoPlay', 'autoReset', 'allowOverdue'].every((field) => typeof value[field] === 'boolean');
}
function isPomodoro(value: unknown): value is PomodoroConfig {
  if (!isRecord(value) || !isIntegerIn(value.cycles, 1, 10) || !isIntegerIn(value.workDurationMin, 1, 240) ||
    !isIntegerIn(value.shortBreakMin, 1, 120) || !isIntegerIn(value.longBreakMin, 1, 240)) return false;
  return (value.currentCycle === undefined || isIntegerIn(value.currentCycle, 0, value.cycles)) &&
    (value.isBreak === undefined || typeof value.isBreak === 'boolean') &&
    (value.autoStart === undefined || typeof value.autoStart === 'boolean') &&
    (value.autoPlay === undefined || typeof value.autoPlay === 'boolean');
}
function isTask(value: unknown): value is Task {
  if (!isRecord(value) || !isString(value.id) || !isString(value.title) || !isString(value.workspace) ||
    !isOneOf<TaskStatus>(value.status, ['active', 'done', 'archived']) ||
    !isOneOf<TimerMode>(value.timerMode, ['duration', 'pomodoro', 'deadline']) ||
    !isFiniteNumber(value.remainingSec) || !isFiniteNumber(value.originalDurationSec) ||
    !isOneOf<TimerStatus>(value.timerStatus, ['running', 'paused', 'idle', 'expired']) ||
    !Array.isArray(value.reminders) || !isIsoTimestamp(value.createdAt) || !isIsoTimestamp(value.updatedAt)) return false;
  if ((value.targetAt !== undefined && !isIsoTimestamp(value.targetAt)) ||
    (value.lastTimerUpdateAt !== undefined && !isIsoTimestamp(value.lastTimerUpdateAt)) ||
    (value.pausedTimerRemainderMs !== undefined && !isIntegerIn(value.pausedTimerRemainderMs, 0, 999)) ||
    (value.timerControls !== undefined && !isTimerControls(value.timerControls)) ||
    (value.pomodoro !== undefined && !isPomodoro(value.pomodoro))) return false;
  return value.reminders.every((reminder) => isRecord(reminder) && isString(reminder.id) && typeof reminder.enabled === 'boolean');
}

/** Complete compatible records remain opaque except the required all → work migration. */
export function decodeTaskStorage(raw: string): DecodedTasks | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(parsed) || !parsed.every(isTask)) return null;
  if (new Set(parsed.map((task) => task.id)).size !== parsed.length) return null;
  const migrated = parsed.some((task) => task.workspace === 'all');
  return { tasks: parsed.map((task) => task.workspace === 'all' ? { ...task, workspace: 'work' } : task), migrated };
}

function locks(): LockManagerLike | null {
  if (typeof navigator === 'undefined') return null;
  const candidate = (navigator as Navigator & { locks?: LockManagerLike }).locks;
  return candidate && typeof candidate.request === 'function' ? candidate : null;
}
function sameTasks(left: Task[], right: Task[]): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function message(kind: TaskPersistenceStatus['kind']): string {
  if (kind === 'unsupported') return 'Safe local synchronization is unavailable. Your changes remain only in this tab.';
  if (kind === 'conflict') return 'Tasks changed in another tab. Reload to use that version; this tab was not overwritten.';
  return 'Tasks could not be safely saved. Your stored data was left unchanged.';
}
function recoveryKey(raw: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${TASK_RECOVERY_KEY}-${raw.length}-${(hash >>> 0).toString(16)}`;
}
function normalizeLegacyRunningTasks(tasks: Task[], nowIso: string): { tasks: Task[]; changed: boolean } {
  let changed = false;
  const normalized = tasks.map((task) => {
    if (task.status !== 'active' || !shouldTickTimer(task) || task.timerMode === 'deadline' || task.lastTimerUpdateAt !== undefined) return task;
    changed = true;
    return { ...task, lastTimerUpdateAt: nowIso };
  });
  return { tasks: normalized, changed };
}

export interface TaskPersistenceController {
  persistence: TaskPersistenceStatus;
  registerLocalSnapshot: (tasks: Task[]) => void;
  persist: () => void;
  retry: () => void;
  reload: () => void;
  recover: () => void;
}

export function useTaskPersistence(applyExternal: (tasks: Task[], clearSelection: boolean) => void): TaskPersistenceController {
  const [persistence, setPersistence] = useState<TaskPersistenceStatus>({ kind: 'ready' });
  const confirmedTasksRef = useRef<Task[]>([]);
  const rawRef = useRef<string | null>(null);
  const desiredRef = useRef<Task[]>([]);
  const generationRef = useRef(0);
  const intentRef = useRef(false);
  const migrationRef = useRef(false);
  const normalizingRef = useRef(false);
  const blockedRef = useRef(false);
  const recoveryRawRef = useRef<string | null>(null);
  const drainingRef = useRef(false);
  const mountedRef = useRef(true);

  const fail = useCallback((status: TaskPersistenceStatus) => {
    blockedRef.current = status.kind !== 'ready';
    if (mountedRef.current) setPersistence(status);
  }, []);
  const preserveRaw = useCallback((raw: string): boolean => {
    try {
      const key = recoveryKey(raw);
      const existing = window.localStorage.getItem(key);
      if (existing === raw) return true;
      if (existing !== null) return false;
      window.localStorage.setItem(key, raw);
      return true;
    } catch { return false; }
  }, []);
  const publishExternal = useCallback((tasks: Task[], raw: string | null, clearSelection: boolean) => {
    // The Provider updates its synchronous state owner before this raw value can
    // become the baseline for a later local compare-and-swap.
    applyExternal(tasks, clearSelection);
    generationRef.current += 1;
    rawRef.current = raw;
    confirmedTasksRef.current = tasks;
    desiredRef.current = tasks;
    intentRef.current = false;
  }, [applyExternal]);

  const drain = useCallback(() => {
    if (drainingRef.current || blockedRef.current) return;
    const lockManager = locks();
    if (!lockManager) {
      fail({ kind: 'unsupported', message: message('unsupported') });
      return;
    }
    drainingRef.current = true;
    void (async () => {
      try {
        while (!blockedRef.current) {
          const queuedGeneration = generationRef.current;
          await lockManager.request(TASK_LOCK_NAME, async () => {
            // A held lock may allow add/delete/undo/reload. Only the latest
            // generation is eligible once exclusive access actually begins.
            if (blockedRef.current || queuedGeneration !== generationRef.current) return;
            const currentRaw = window.localStorage.getItem(TASK_STORAGE_KEY);
            if (currentRaw !== rawRef.current) {
              const decoded = currentRaw === null ? { tasks: [] as Task[], migrated: false } : decodeTaskStorage(currentRaw);
              if (decoded && normalizingRef.current && !intentRef.current) {
                const normalized = normalizeLegacyRunningTasks(decoded.tasks, new Date().toISOString());
                const requiresWrite = decoded.migrated || normalized.changed;
                if (requiresWrite && currentRaw !== null && !preserveRaw(currentRaw)) {
                  fail({ kind: 'unsaved', reason: 'recovery', message: message('unsaved') });
                  return;
                }
                blockedRef.current = false;
                recoveryRawRef.current = null;
                migrationRef.current = requiresWrite;
                normalizingRef.current = normalized.changed;
                publishExternal(normalized.tasks, currentRaw, false);
                if (!requiresWrite && mountedRef.current) setPersistence({ kind: 'ready' });
                return;
              }
              fail({ kind: 'conflict', message: message('conflict'), localTasks: desiredRef.current, externalTasks: decoded?.tasks ?? [] });
              return;
            }
            const latestDesired = desiredRef.current;
            if (!migrationRef.current && sameTasks(latestDesired, confirmedTasksRef.current)) {
              intentRef.current = false;
              if (mountedRef.current) setPersistence({ kind: 'ready' });
              return;
            }
            if (queuedGeneration !== generationRef.current) return;
            const nextRaw = JSON.stringify(latestDesired);
            window.localStorage.setItem(TASK_STORAGE_KEY, nextRaw);
            rawRef.current = nextRaw;
            confirmedTasksRef.current = latestDesired;
            migrationRef.current = false;
            normalizingRef.current = false;
            intentRef.current = false;
            if (mountedRef.current) setPersistence({ kind: 'ready' });
          });
          if (blockedRef.current || queuedGeneration === generationRef.current) break;
        }
      } catch {
        fail({ kind: 'unsaved', reason: 'write', message: message('unsaved') });
      } finally {
        drainingRef.current = false;
        if (!blockedRef.current && (!sameTasks(desiredRef.current, confirmedTasksRef.current) || migrationRef.current)) drain();
      }
    })();
  }, [fail, preserveRaw, publishExternal]);

  const readLive = useCallback((reload: boolean) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(TASK_STORAGE_KEY);
      const decoded = raw === null ? { tasks: [] as Task[], migrated: false } : decodeTaskStorage(raw);
      if (!decoded) {
        const recovered = raw !== null && preserveRaw(raw);
        recoveryRawRef.current = recovered ? raw : null;
        fail({ kind: 'unsaved', reason: recovered ? 'invalid' : 'recovery', message: message('unsaved') });
        if (reload) publishExternal([], raw, true);
        return;
      }
      if (!reload && (intentRef.current || !sameTasks(desiredRef.current, confirmedTasksRef.current))) {
        fail({ kind: 'conflict', message: message('conflict'), localTasks: desiredRef.current, externalTasks: decoded.tasks });
        return;
      }
      const normalized = normalizeLegacyRunningTasks(decoded.tasks, new Date().toISOString());
      const requiresWrite = decoded.migrated || normalized.changed;
      if (requiresWrite && raw !== null && !preserveRaw(raw)) {
        fail({ kind: 'unsaved', reason: 'recovery', message: message('unsaved') });
        return;
      }
      blockedRef.current = false;
      recoveryRawRef.current = null;
      migrationRef.current = requiresWrite;
      normalizingRef.current = normalized.changed;
      publishExternal(normalized.tasks, raw, reload);
      if (requiresWrite) drain();
      else setPersistence({ kind: 'ready' });
    } catch {
      fail({ kind: 'unsaved', reason: 'read', message: message('unsaved') });
    }
  }, [drain, fail, preserveRaw, publishExternal]);

  useEffect(() => {
    mountedRef.current = true;
    readLive(false);
    return () => { mountedRef.current = false; };
  }, [readLive]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || (event.key !== TASK_STORAGE_KEY && event.key !== null)) return;
      // A delayed event may describe the already-confirmed raw value. Do not
      // turn a pending local edit into a conflict for an unchanged snapshot.
      // Blocked states still reread it so recovery retries are never swallowed.
      try {
        if (!blockedRef.current && window.localStorage.getItem(TASK_STORAGE_KEY) === rawRef.current) return;
      } catch {
        // readLive reports the storage failure through the visible status.
      }
      readLive(false);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [readLive]);

  const registerLocalSnapshot = useCallback((tasks: Task[]) => {
    desiredRef.current = tasks;
    generationRef.current += 1;
    intentRef.current = true;
  }, []);
  const persist = useCallback(() => drain(), [drain]);
  const retry = useCallback(() => {
    if (persistence.kind === 'conflict') {
      try {
        if (window.localStorage.getItem(TASK_STORAGE_KEY) === rawRef.current) {
          blockedRef.current = false;
          drain();
          return;
        }
      } catch {
        // readLive below reports the storage failure.
      }
      readLive(false);
      return;
    }
    if (persistence.kind === 'unsaved' && persistence.reason !== 'write') {
      if (persistence.reason === 'replace') return;
      readLive(false);
      return;
    }
    blockedRef.current = false;
    drain();
  }, [drain, persistence, readLive]);
  const reload = useCallback(() => {
    generationRef.current += 1;
    intentRef.current = false;
    blockedRef.current = false;
    readLive(true);
  }, [readLive]);

  const recover = useCallback(() => {
    const expectedRaw = recoveryRawRef.current;
    const lockManager = locks();
    if (expectedRaw === null) return;
    if (!lockManager) {
      fail({ kind: 'unsupported', message: message('unsupported') });
      return;
    }
    void lockManager.request(TASK_LOCK_NAME, async () => {
      try {
        if (recoveryRawRef.current !== expectedRaw) return;
        const currentRaw = window.localStorage.getItem(TASK_STORAGE_KEY);
        if (currentRaw !== expectedRaw || recoveryRawRef.current !== expectedRaw) {
          const decoded = currentRaw === null ? { tasks: [] as Task[] } : decodeTaskStorage(currentRaw);
          fail({ kind: 'conflict', message: message('conflict'), localTasks: desiredRef.current, externalTasks: decoded?.tasks ?? [] });
          return;
        }
        if (!preserveRaw(expectedRaw)) {
          fail({ kind: 'unsaved', reason: 'recovery', message: message('unsaved') });
          return;
        }
        const replacement = desiredRef.current;
        const replacementRaw = JSON.stringify(replacement);
        window.localStorage.setItem(TASK_STORAGE_KEY, replacementRaw);
        rawRef.current = replacementRaw;
        confirmedTasksRef.current = replacement;
        migrationRef.current = false;
        intentRef.current = false;
        recoveryRawRef.current = null;
        blockedRef.current = false;
        if (mountedRef.current) setPersistence({ kind: 'ready' });
      } catch {
        fail({ kind: 'unsaved', reason: 'replace', message: message('unsaved') });
      }
    }).catch(() => {
      fail({ kind: 'unsaved', reason: 'replace', message: message('unsaved') });
    });
  }, [fail, preserveRaw]);

  return { persistence, registerLocalSnapshot, persist, retry, reload, recover };
}
