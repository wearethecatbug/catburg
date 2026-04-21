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
  displayTime: string;
  fullTimeText: string;
  onToggleTimer: () => void;
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
  displayTime,
  fullTimeText,
  onToggleTimer,
}: TaskTimerClusterProps) {
  if (!showTimerButton) {
    return <GhostTimer className="ml-1" label={displayTime} sizePx={30} />;
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
    <div
      data-testid="task-timer-cluster"
      title={fullTimeText}
      className="ml-1 inline-flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1"
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
  );
}

