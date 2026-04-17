'use client';

import type { TaskStatus } from '@/domain/task.types';

interface TaskMetaClusterProps {
  showUrgentIndicator: boolean;
  status: TaskStatus;
  visualVariant?: 'soft-inset' | 'legacy-bar';
}

export function TaskMetaCluster({
  showUrgentIndicator,
  status,
  visualVariant = 'soft-inset',
}: TaskMetaClusterProps) {
  const isDone = status === 'done';

  if (visualVariant === 'legacy-bar') {
    const barColor = isDone ? 'var(--tt-priority-done-bar)' : 'var(--tt-priority-urgent-bar)';
    const barBorder = isDone ? 'var(--tt-priority-done-bar-border)' : 'var(--tt-priority-urgent-bar-border)';
    const barGlow = isDone ? 'transparent' : 'var(--tt-priority-urgent-bar-glow)';
    const barGradient = isDone
      ? `linear-gradient(180deg,
          color-mix(in srgb, ${barColor} 16%, transparent) 0%,
          color-mix(in srgb, ${barColor} 52%, transparent) 24%,
          ${barColor} 54%,
          color-mix(in srgb, ${barColor} 56%, white) 78%,
          color-mix(in srgb, ${barColor} 34%, white) 100%)`
      : `linear-gradient(180deg,
          color-mix(in srgb, ${barColor} 24%, transparent) 0%,
          color-mix(in srgb, ${barColor} 72%, transparent) 28%,
          ${barColor} 54%,
          color-mix(in srgb, ${barColor} 58%, #fff7b8) 78%,
          #fff7b8 100%)`;

    return (
      <div
        data-testid="task-priority-slot"
        className="mr-[5px] flex h-[40px] w-[10px] shrink-0 items-stretch justify-end py-[3px] pr-[1px]"
        aria-hidden="true"
      >
        {showUrgentIndicator && (
          <span
            data-testid="task-priority-bar"
            className="inline-flex h-full w-[2px] rounded-full"
            style={{
              backgroundColor: barColor,
              backgroundImage: barGradient,
              boxShadow: `0 0 0 0.5px ${barBorder}, 0 0 4px ${barGlow}`,
              opacity: 1,
            }}
          />
        )}
      </div>
    );
  }

  const insetColor = isDone
    ? 'color-mix(in srgb, var(--tt-text-soft) 42%, white)'
    : 'color-mix(in srgb, var(--tt-text-muted) 54%, white)';
  const insetBorder = `color-mix(in srgb, ${insetColor} 26%, transparent)`;
  const insetGradient = `linear-gradient(180deg,
      color-mix(in srgb, ${insetColor} 22%, transparent) 0%,
      color-mix(in srgb, ${insetColor} 58%, transparent) 28%,
      ${insetColor} 60%,
      color-mix(in srgb, ${insetColor} 38%, white) 100%)`;

  return (
    <div
      data-testid="task-priority-slot"
      className="mr-[5px] flex h-[40px] w-[10px] shrink-0 items-stretch justify-center py-[4px]"
      aria-hidden="true"
    >
      {showUrgentIndicator && (
        <span
          data-testid="task-priority-bar"
          className="inline-flex h-full w-[1.5px] rounded-full"
          style={{
            backgroundColor: insetColor,
            backgroundImage: insetGradient,
            boxShadow: `inset 0 0 0 0.5px ${insetBorder}`,
            opacity: 1,
          }}
        />
      )}
    </div>
  );
}


