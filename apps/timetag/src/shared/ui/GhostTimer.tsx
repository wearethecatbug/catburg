import React from 'react';

type GhostTimerProps = {
  label?: string;
  showLabel?: boolean;
  sizePx?: number;
  className?: string;
};

const GHOST_TIMER_STYLE = {
  wrapperOpacity: 0.82,
  surfaceBackground: 'transparent',
  textColor: 'color-mix(in srgb, var(--tt-text) 26%, var(--tt-text-muted))',
  capsuleBorder: 'color-mix(in srgb, var(--tt-border) 40%, transparent)',
  capsuleBackground: 'color-mix(in srgb, var(--tt-surface-elevated) 10%, transparent)',
};

const GHOST_RING_STYLE = {
  ringStroke: 'color-mix(in srgb, var(--tt-border-strong) 82%, white)',
  strokeWidth: 1.6,
  strokeDasharray: '3.5 2',
};

const GHOST_TIMER_LAYOUT = {
  horizontalPaddingPx: 12,
  labelMinWidthPx: 56,
  labelRightPaddingPx: 4,
  ringLabelGapPx: 4,
};

export function GhostTimer({
  label = 'no timer',
  showLabel = true,
  sizePx = 30,
  className,
}: GhostTimerProps) {
  const radius = 15;
  const center = 18;
  const tokenWidthPx =
    sizePx +
    GHOST_TIMER_LAYOUT.horizontalPaddingPx +
    GHOST_TIMER_LAYOUT.labelMinWidthPx +
    GHOST_TIMER_LAYOUT.labelRightPaddingPx +
    GHOST_TIMER_LAYOUT.ringLabelGapPx;

  return (
    <div
      data-testid="ghost-timer"
      aria-hidden="true"
      role="presentation"
      className={[
        'inline-flex h-[38px] shrink-0 items-center justify-start gap-1 rounded-full px-1.5 py-1 align-middle',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        color: GHOST_TIMER_STYLE.textColor,
        opacity: GHOST_TIMER_STYLE.wrapperOpacity,
        minWidth: tokenWidthPx,
        background: GHOST_TIMER_STYLE.capsuleBackground,
        boxShadow: `inset 0 0 0 1px ${GHOST_TIMER_STYLE.capsuleBorder}`,
      }}
    >
      <span
        className="relative inline-flex items-center justify-center rounded-full"
        style={{
          width: sizePx,
          height: sizePx,
          background: GHOST_TIMER_STYLE.surfaceBackground,
        }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0"
          viewBox="0 0 36 36"
          width={sizePx}
          height={sizePx}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={GHOST_RING_STYLE.ringStroke}
            strokeWidth={GHOST_RING_STYLE.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={GHOST_RING_STYLE.strokeDasharray}
          />
        </svg>
      </span>

      {showLabel && (
        <span className="inline-flex h-full min-w-[56px] items-center justify-end whitespace-nowrap pr-1 text-right text-[13px] font-medium tracking-[-0.01em] leading-none">
          {label}
        </span>
      )}
    </div>
  );
}






