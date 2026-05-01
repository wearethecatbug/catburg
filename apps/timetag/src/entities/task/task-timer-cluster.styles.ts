import type { CSSProperties } from 'react';
import type { TaskStatus } from '@/domain/task.types';
import type { TimerClusterVisualState } from '@/domain/timer.ring';

export interface TaskTimerClusterStyles {
  clusterStyle: CSSProperties;
  valueStyle: CSSProperties;
}

export function getTaskTimerClusterStyles(args: {
  status: TaskStatus;
  visualState: TimerClusterVisualState;
}): TaskTimerClusterStyles {
  const { status, visualState } = args;

  if (status === 'archived') {
    return {
      clusterStyle: {
        background: 'var(--tt-surface-subtle)',
        color: 'var(--tt-text-soft)',
        opacity: 0.8,
      },
      valueStyle: { color: 'var(--tt-text-soft)' },
    };
  }

  if (status === 'done') {
    return {
      clusterStyle: {
        background: 'var(--tt-surface-hover)',
        color: 'var(--tt-text-soft)',
        opacity: 0.72,
      },
      valueStyle: { color: 'var(--tt-text-soft)' },
    };
  }

  switch (visualState) {
    case 'paused':
      return {
        clusterStyle: {
          background: 'var(--tt-chip-paused-bg)',
          color: 'var(--tt-chip-paused-text)',
        },
        valueStyle: { color: 'var(--tt-chip-paused-text)' },
      };
    case 'running':
    case 'focus':
      return {
        clusterStyle: {
          background: 'var(--tt-chip-active-bg)',
          color: 'var(--tt-chip-active-text)',
          boxShadow: 'inset 0 0 0 1px var(--tt-chip-active-border)',
        },
        valueStyle: { color: 'var(--tt-chip-active-text)' },
      };
    case 'break':
      return {
        clusterStyle: {
          background: 'var(--tt-chip-paused-bg)',
          color: 'var(--tt-chip-paused-text)',
          boxShadow: 'inset 0 0 0 1px var(--tt-chip-paused-border)',
        },
        valueStyle: { color: 'var(--tt-chip-paused-text)' },
      };
    case 'longBreak':
      return {
        clusterStyle: {
          background: 'var(--tt-chip-idle-bg)',
          color: 'var(--tt-chip-idle-text)',
          boxShadow: 'inset 0 0 0 1px var(--tt-border-strong)',
        },
        valueStyle: { color: 'var(--tt-chip-idle-text)' },
      };
    case 'finished':
      return {
        clusterStyle: {
          background: 'var(--tt-surface-hover)',
          color: 'var(--tt-text-soft)',
          boxShadow: 'inset 0 0 0 1px var(--tt-border)',
        },
        valueStyle: { color: 'var(--tt-text-soft)' },
      };
    case 'warn':
      return {
        clusterStyle: {
          background: 'var(--tt-chip-warning-bg)',
          color: 'var(--tt-chip-warning-text)',
          boxShadow: 'inset 0 0 0 1px var(--tt-chip-warning-border)',
        },
        valueStyle: { color: 'var(--tt-chip-warning-text)' },
      };
    case 'danger':
    case 'zero':
      return {
        clusterStyle: {
          background: 'var(--tt-chip-zero-bg)',
          color: 'var(--tt-chip-zero-text)',
          boxShadow: 'inset 0 0 0 1px var(--tt-chip-zero-border)',
        },
        valueStyle: { color: 'var(--tt-chip-zero-text)' },
      };
    case 'overdue':
      return {
        clusterStyle: {
          background: 'var(--tt-chip-overdue-bg)',
          color: 'var(--tt-chip-overdue-text)',
        },
        valueStyle: { color: 'var(--tt-chip-overdue-text)' },
      };
    case 'disabled':
    case 'idle':
    default:
      return {
        clusterStyle: {
          background: 'var(--tt-chip-idle-bg)',
          color: 'var(--tt-chip-idle-text)',
        },
        valueStyle: { color: 'var(--tt-chip-idle-text)' },
      };
  }
}

