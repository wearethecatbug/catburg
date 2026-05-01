import React from 'react';
import { getTimerClusterVisualState } from '@/domain/timer.ring';
import type { TaskStatus, TimerDisplayMeta, UrgencyLevel } from '@/domain/task.types';
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
  timerDisplay: TimerDisplayMeta;
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
  timerDisplay,
  fullTimeText,
  onToggleTimer,
  onRestartTimer,
}: TaskTimerClusterProps) {
  const TIMER_SLOT_CLASS_NAME = 'flex h-[40px] w-[124px] shrink-0 items-center justify-center';

  if (!showTimerButton) {
    return (
      <div className={TIMER_SLOT_CLASS_NAME}>
        <GhostTimer label={timerDisplay.displayTime} sizePx={30} />
      </div>
    );
  }

  const visualState = getTimerClusterVisualState({
    remainingSec,
    timerStatus: isPaused ? 'paused' : isRunning ? 'running' : 'idle',
    urgency,
    tone: timerDisplay.tone,
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
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-1.5 py-0.5"
        style={clusterStyle}
      >
        <TimerRingButton
          isRunning={isRunning}
          isPaused={isPaused}
          remainingSec={remainingSec}
          totalSec={totalSec}
          urgency={urgency}
          tone={timerDisplay.tone}
          disabled={isTimerDisabled}
          onToggleAction={onToggleTimer}
          enableDoubleClickGesture={shouldInterceptDoubleClickGesture}
          onRestartAction={isDoubleClickRestartEnabled ? onRestartTimer : undefined}
          sizePx={30}
          strokeWidth={2.75}
          embedded
        />

        <div className="flex min-w-0 items-center justify-end gap-1 pr-1 text-right leading-none">
          <span
            className="min-w-[44px] text-[13px] font-medium tabular-nums"
            style={valueStyle}
          >
            {timerDisplay.displayTime}
          </span>

          {timerDisplay.displayMeta && (
            <span
              data-testid="task-timer-meta"
              className="min-w-[22px] text-[11px] font-semibold tabular-nums uppercase tracking-[0.01em]"
              style={{ ...valueStyle, opacity: 0.76 }}
            >
              {timerDisplay.displayMeta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

