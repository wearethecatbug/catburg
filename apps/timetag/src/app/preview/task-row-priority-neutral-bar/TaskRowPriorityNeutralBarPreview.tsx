'use client';

import React from 'react';
import type { TaskPriority, TaskStatus } from '@/domain/task.types';
import { SelectionCheckbox, TaskStatusToggle } from '@/entities/task';
import { MoreVerticalIcon } from '@/shared';

type NeutralBarPreviewVariant = 'soft-tail' | 'clear-tail';

interface NeutralBarVariantConfig {
  id: NeutralBarPreviewVariant;
  title: string;
  badge: string;
  summary: string;
  recommended?: boolean;
}

interface PreviewTask {
  id: string;
  title: string;
  note?: string;
  priority: TaskPriority;
  status: TaskStatus;
  timerLabel: string;
}

const NEUTRAL_BAR_VARIANTS: NeutralBarVariantConfig[] = [
  {
    id: 'soft-tail',
    title: 'Softer warm tail',
    badge: 'Lower warmth / quieter read',
    summary: 'The marker stays mostly neutral gray, with only a faint warm tint at the very end of the tail.',
    recommended: true,
  },
  {
    id: 'clear-tail',
    title: 'Clearer warm tail',
    badge: 'Slightly more readable tail',
    summary: 'Still neutral overall, but the warm tail is easier to notice when comparing urgent rows at a glance.',
  },
];

const PREVIEW_TASKS: PreviewTask[] = [
  {
    id: 'urgent-note',
    title: 'Urgent note task',
    note: 'Important follow-up note that should stay readable under the title.',
    priority: 'urgent',
    status: 'active',
    timerLabel: '10m',
  },
  {
    id: 'urgent-plain',
    title: 'Urgent plain task',
    priority: 'urgent',
    status: 'active',
    timerLabel: '15m',
  },
  {
    id: 'normal',
    title: 'Plain task for alignment comparison',
    priority: 'normal',
    status: 'active',
    timerLabel: '30m',
  },
  {
    id: 'done-urgent',
    title: 'Completed urgent task',
    note: 'Completed note content',
    priority: 'urgent',
    status: 'done',
    timerLabel: 'Done',
  },
];

function NeutralPrioritySlotPreview({
  task,
  variant,
}: {
  task: PreviewTask;
  variant: NeutralBarPreviewVariant;
}) {
  const isUrgent = task.priority === 'urgent';
  const isDone = task.status === 'done';
  const barColor = isDone ? 'color-mix(in srgb, var(--tt-text-soft) 44%, white)' : 'color-mix(in srgb, var(--tt-text-muted) 58%, white)';
  const barBorder = isDone
    ? 'color-mix(in srgb, var(--tt-text-soft) 28%, transparent)'
    : 'color-mix(in srgb, var(--tt-text-muted) 18%, transparent)';
  const warmTailColor = variant === 'soft-tail'
    ? 'color-mix(in srgb, #f4dea1 22%, white)'
    : 'color-mix(in srgb, #f4dea1 40%, white)';
  const barGradient = isDone
    ? `linear-gradient(180deg,
        color-mix(in srgb, ${barColor} 20%, transparent) 0%,
        color-mix(in srgb, ${barColor} 52%, transparent) 26%,
        ${barColor} 56%,
        color-mix(in srgb, ${barColor} 62%, white) 82%,
        color-mix(in srgb, ${barColor} 34%, white) 100%)`
    : `linear-gradient(180deg,
        color-mix(in srgb, ${barColor} 18%, transparent) 0%,
        color-mix(in srgb, ${barColor} 48%, transparent) 24%,
        ${barColor} 54%,
        color-mix(in srgb, ${barColor} ${variant === 'soft-tail' ? 80 : 66}%, ${warmTailColor}) 78%,
        color-mix(in srgb, ${barColor} ${variant === 'soft-tail' ? 40 : 22}%, ${warmTailColor}) 100%)`;

  return (
    <div className="mr-[5px] flex h-[40px] w-[10px] shrink-0 items-stretch justify-end py-[3px] pr-[1px]" aria-hidden="true">
      {isUrgent && (
        <span
          className="inline-flex h-full w-[2px] rounded-full"
          style={{
            backgroundColor: barColor,
            backgroundImage: barGradient,
            boxShadow: `0 0 0 0.5px ${barBorder}`,
          }}
        />
      )}
    </div>
  );
}

function PreviewTimerPill({ label }: { label: string }) {
  return (
    <div
      className="ml-1 inline-flex h-8 min-w-[78px] shrink-0 items-center justify-center rounded-full px-3 text-[13px] font-medium"
      style={{
        background: 'var(--tt-surface)',
        boxShadow: 'inset 0 0 0 1px var(--tt-border)',
        color: 'var(--tt-text-muted)',
      }}
    >
      {label}
    </div>
  );
}

function PreviewActionsButton() {
  return (
    <div className="ml-3 shrink-0 rounded-lg p-1.5" style={{ color: 'var(--tt-text-soft)' }}>
      <MoreVerticalIcon size="sm" aria-label="Preview row options" />
    </div>
  );
}

function PreviewTaskRow({
  task,
  variant,
}: {
  task: PreviewTask;
  variant: NeutralBarPreviewVariant;
}) {
  const isDone = task.status === 'done';
  const showNote = Boolean(task.note);

  return (
    <div
      className="group flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--tt-surface-elevated)',
        boxShadow: 'inset 0 0 0 1px var(--tt-border)',
      }}
    >
      <SelectionCheckbox checked={false} onChange={() => {}} ariaLabel={`Preview select ${task.title}`} />
      <TaskStatusToggle status={task.status} isSelected={false} onToggle={() => {}} />

      <div className="min-w-0 flex-1 pr-2">
        <div className="flex min-w-0 items-start text-sm">
          <NeutralPrioritySlotPreview task={task} variant={variant} />

          <div className="min-h-[40px] min-w-0 flex-1">
            <span
              className={`block min-w-0 truncate text-[15px] font-medium leading-5 ${isDone ? 'line-through' : ''}`}
              style={isDone ? { color: 'var(--tt-text-soft)', opacity: 0.9 } : { color: 'var(--tt-text)' }}
            >
              {task.title}
            </span>

            {showNote && (
              <div
                className="mt-1 overflow-hidden pr-2 text-[12px] leading-[1.3]"
                style={{
                  color: 'var(--tt-text-soft)',
                  opacity: isDone ? 0.72 : 1,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 1,
                }}
                title={task.note}
              >
                {task.note}
              </div>
            )}
          </div>
        </div>
      </div>

      <PreviewTimerPill label={task.timerLabel} />
      <PreviewActionsButton />
    </div>
  );
}

function VariantCard({ variant }: { variant: NeutralBarVariantConfig }) {
  return (
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
            {variant.badge}
          </p>
          <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--tt-text)' }}>
            {variant.title}
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            {variant.summary}
          </p>
        </div>
        {variant.recommended && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
            style={{ background: 'var(--tt-surface)', color: 'var(--tt-text-muted)', boxShadow: 'inset 0 0 0 1px var(--tt-border)' }}
          >
            Review focus
          </span>
        )}
      </div>

      <div className="space-y-3">
        {PREVIEW_TASKS.map((task) => (
          <PreviewTaskRow key={`${variant.id}-${task.id}`} task={task} variant={variant.id} />
        ))}
      </div>
    </section>
  );
}

function RationaleCard() {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        background: 'var(--tt-surface-elevated)',
        borderColor: 'var(--tt-border)',
        boxShadow: 'var(--tt-shadow-soft)',
      }}
    >
      <h2 className="text-base font-semibold" style={{ color: 'var(--tt-text)' }}>
        What to compare here
      </h2>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
        Both options keep the same fixed slot and neutral gray body. The only change is how much warmth appears in the final tail,
        so you can judge whether a subtle hint helps discoverability without turning the marker back into a bright warning accent.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--tt-text)' }}>Softer tail</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            <li>• Feels closest to neutral metadata.</li>
            <li>• Lowest risk of looking like a warning or separator.</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--tt-text)' }}>Clearer tail</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            <li>• Slightly easier to notice in dense lists.</li>
            <li>• Still calmer than the original yellow bar.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function TaskRowPriorityNeutralBarPreview() {
  return (
    <main className="min-h-screen px-6 py-8" style={{ background: 'var(--tt-app-bg)' }}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>
            Task row priority preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold" style={{ color: 'var(--tt-text)' }}>
            Third option — muted neutral bar micro-variants
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            This host isolates the quieter alternative: keep the fixed priority slot, but replace the strong yellow marker with a neutral muted bar.
            Below, two micro-variants compare how much warm tint should remain at the tail, without changing production `TaskRow` behavior.
          </p>
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm leading-6"
            style={{
              borderColor: 'var(--tt-border)',
              background: 'var(--tt-surface)',
              color: 'var(--tt-text-muted)',
            }}
          >
            Preview URL: <code style={{ color: 'var(--tt-text)' }}>/preview/task-row-priority-neutral-bar</code>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-6 xl:grid-cols-2">
            {NEUTRAL_BAR_VARIANTS.map((variant) => (
              <VariantCard key={variant.id} variant={variant} />
            ))}
          </div>
          <RationaleCard />
        </div>
      </div>
    </main>
  );
}



