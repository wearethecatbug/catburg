import React from 'react';
import { getTimerClusterVisualState } from '@/domain/timer.ring';
import type { TaskStatus, UrgencyLevel } from '@/domain/task.types';
import { GhostTimer, TimerRingButton } from '@/shared';
import { getTaskTimerClusterStyles } from '../task-timer-cluster.styles';

interface TaskTimerClusterProps {
  status: TaskStatus;
  remainingSec: number;
  totalSec: number;
  urgency: UrgencyLevel;
  showTimerButton: boolean;
  isRunning: boolean;
  isPaused: boolean;
  isTimerDisabled: boolean;
  shouldInterceptDoubleClickGesture: boolean;
  isDoubleClickRestartEnabled: boolean;
  displayTime: string;
  fullTimeText: string;
  onToggleTimer: () => void;
  onRestartTimer: () => void;
}

export function TaskTimerCluster({
  status,
  remainingSec,
  totalSec,
  urgency,
  showTimerButton,
  isRunning,
  isPaused,
  isTimerDisabled,
  shouldInterceptDoubleClickGesture,
  isDoubleClickRestartEnabled,
  displayTime,
  fullTimeText,
  onToggleTimer,
  onRestartTimer,
}: TaskTimerClusterProps) {
  const TIMER_SLOT_CLASS_NAME = 'flex h-[40px] w-[104px] shrink-0 items-center justify-center';

  if (!showTimerButton) {
    return (
      <div className={TIMER_SLOT_CLASS_NAME}>
        <GhostTimer label={displayTime} sizePx={30} />
      </div>
    );
  }

  const visualState = getTimerClusterVisualState({
    remainingSec,
    timerStatus: isPaused ? 'paused' : isRunning ? 'running' : 'idle',
    urgency,
    disabled: isTimerDisabled,
  });
  const { clusterStyle, valueStyle } = getTaskTimerClusterStyles({
    status,
    visualState,
  });


  return (
    <div className={TIMER_SLOT_CLASS_NAME}>
      <div
        data-testid="task-timer-cluster"
        title={fullTimeText}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-1.5 py-1"
        style={clusterStyle}
      >
        <TimerRingButton
          isRunning={isRunning}
          isPaused={isPaused}
          remainingSec={remainingSec}
          totalSec={totalSec}
          urgency={urgency}
          disabled={isTimerDisabled}
          onToggleAction={onToggleTimer}
          enableDoubleClickGesture={shouldInterceptDoubleClickGesture}
          onRestartAction={isDoubleClickRestartEnabled ? onRestartTimer : undefined}
          sizePx={30}
          strokeWidth={2.75}
          embedded
        />

        <span
          className="min-w-[56px] pr-1 text-right text-[13px] font-medium tabular-nums leading-none"
          style={valueStyle}
        >
          {displayTime}
        </span>
      </div>
    </div>
  );
}

