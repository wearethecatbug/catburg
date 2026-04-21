'use client';

import React from 'react';
import { GhostTimer, MoreVerticalIcon, TimerRingButton } from '@/shared';

function BaseRow({
  title,
  description,
  timerSlot,
}: {
  title: string;
  description: string;
  timerSlot: React.ReactNode;
}) {
  return (
    <div
      className="group flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--tt-surface-elevated)',
        boxShadow: 'inset 0 0 0 1px var(--tt-border)',
      }}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 shrink-0 rounded-full border"
        style={{ borderColor: 'var(--tt-border-strong)' }}
      />
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 shrink-0 rounded-full border"
        style={{ borderColor: 'var(--tt-border-strong)' }}
      />

      <div className="min-w-0 flex-1 pr-2">
        <div className="min-h-[40px] min-w-0 flex-1">
          <span
            className="block min-w-0 truncate text-[15px] font-medium leading-5"
            style={{ color: 'var(--tt-text)' }}
          >
            {title}
          </span>
          <div
            className="mt-1 overflow-hidden pr-2 text-[12px] leading-[1.3]"
            style={{
              color: 'var(--tt-text-soft)',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 1,
            }}
            title={description}
          >
            {description}
          </div>
        </div>
      </div>

      {timerSlot}

      <div className="ml-3 shrink-0 rounded-lg p-1.5" style={{ color: 'var(--tt-text-soft)' }}>
        <MoreVerticalIcon size="sm" aria-label="Preview row options" />
      </div>
    </div>
  );
}

function ActiveTimerPreviewRow() {
  return (
    <BaseRow
      title="Write team update"
      description="Timed task with an active timer cluster: control plus visible remaining time."
      timerSlot={(
        <div
          className="ml-1 inline-flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1"
          style={{
            background: 'var(--tt-chip-active-bg)',
            boxShadow: 'inset 0 0 0 1px var(--tt-chip-active-border)',
          }}
        >
          <TimerRingButton
            isRunning
            isPaused={false}
            remainingSec={1500}
            totalSec={1800}
            sizePx={30}
            strokeWidth={2.75}
            embedded
          />
          <span
            className="min-w-[56px] pr-1 text-right text-[13px] font-medium tabular-nums leading-none"
            style={{ color: 'var(--tt-chip-active-text)' }}
          >
            25:00
          </span>
        </div>
      )}
    />
  );
}

function GhostTimerPreviewRow() {
  return (
    <BaseRow
      title="Capture user research notes"
      description="Untimed note task with a balanced ghost ring plus a readable no timer label for fast scanning in dense lists."
      timerSlot={<GhostTimer className="ml-1" label="no timer" sizePx={30} />}
    />
  );
}

export default function GhostTimerPreview() {
  return (
    <main className="min-h-screen px-6 py-8" style={{ background: 'var(--tt-app-bg)' }}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>
            Ghost timer preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold" style={{ color: 'var(--tt-text)' }}>
            Compare timer cluster vs no-timer ghost ring
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            This host reviews a single balanced GhostTimer ring as the no-timer state. The goal is a clear categorical distinction between populated timer clusters and untimed note rows, not subtle visual variants of the same pattern.
          </p>
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm leading-6"
            style={{
              borderColor: 'var(--tt-border)',
              background: 'var(--tt-surface)',
              color: 'var(--tt-text-muted)',
            }}
          >
            Preview URL: <code style={{ color: 'var(--tt-text)' }}>/preview/ghost-timer</code>
          </div>
        </header>

        <section
          className="rounded-2xl border p-5"
          style={{
            background: 'var(--tt-surface-elevated)',
            borderColor: 'var(--tt-border)',
            boxShadow: 'var(--tt-shadow-soft)',
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-text-soft)' }}>
                Production candidate
              </p>
              <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--tt-text)' }}>
                Single balanced dashed ring + label
              </h2>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
                The ghost state uses one consistent broken-ring geometry plus a readable no timer label. Timed rows remain visually fuller through control + time, while untimed rows stay clearly identifiable at a glance.
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
              style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}
            >
              Recommended
            </span>
          </div>

          <div className="space-y-3">
            <ActiveTimerPreviewRow />
            <GhostTimerPreviewRow />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--tt-text)' }}>Review notes</h3>
            <ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
              <li>• Dashed geometry remains visible at normal row scale without competing with paused or running timers.</li>
              <li>• Restoring the text label makes the no-timer state identifiable during fast scanning, not only on close inspection.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}


