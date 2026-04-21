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
  verticalPaddingPx: 4,
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
  const wrapperHeightPx = sizePx + GHOST_TIMER_LAYOUT.verticalPaddingPx * 2;
  const labelWidthPx = showLabel
    ? GHOST_TIMER_LAYOUT.labelMinWidthPx +
      GHOST_TIMER_LAYOUT.labelRightPaddingPx +
      GHOST_TIMER_LAYOUT.ringLabelGapPx
    : 0;
  const tokenWidthPx =
    sizePx +
    GHOST_TIMER_LAYOUT.horizontalPaddingPx +
    labelWidthPx;

  return (
    <div
      data-testid="ghost-timer"
      aria-label={showLabel ? undefined : label}
      role={showLabel ? undefined : 'img'}
      className={[
        'inline-flex shrink-0 items-center justify-start rounded-full align-middle',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        color: GHOST_TIMER_STYLE.textColor,
        opacity: GHOST_TIMER_STYLE.wrapperOpacity,
        height: wrapperHeightPx,
        minWidth: tokenWidthPx,
        gap: GHOST_TIMER_LAYOUT.ringLabelGapPx,
        paddingInline: GHOST_TIMER_LAYOUT.horizontalPaddingPx / 2,
        paddingBlock: GHOST_TIMER_LAYOUT.verticalPaddingPx,
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
        <span
          className="inline-flex h-full items-center justify-end whitespace-nowrap text-right text-[13px] font-medium tracking-[-0.01em] leading-none"
          style={{
            minWidth: GHOST_TIMER_LAYOUT.labelMinWidthPx,
            paddingRight: GHOST_TIMER_LAYOUT.labelRightPaddingPx,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}






