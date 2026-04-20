'use client';

import React from 'react';
import type { TaskPriority, TaskStatus } from '@/domain/task.types';
import { TaskMetaCluster, SelectionCheckbox, TaskStatusToggle } from '@/entities/task';
import { MoreVerticalIcon } from '@/shared';

type PriorityPreviewVariant =
  | 'bar'
  | 'title-weight'
  | 'neutral-soft-tail'
  | 'neutral-clear-tail'
  | 'soft-inset-bar'
  | 'dual-tone-neutral-bar'
  | 'micro-capsule';

interface VariantConfig {
  id: PriorityPreviewVariant;
  title: string;
  badge: string;
  summary: string;
  pros: string[];
  cons: string[];
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

const VARIANTS: VariantConfig[] = [
  {
    id: 'bar',
    title: 'Variant A — Separate priority bar',
    badge: 'Current marker approach',
    summary: 'Urgent priority stays in its own fixed slot, so the text column remains stable and the signal does not depend on title length.',
    pros: [
      'Preserves stable title alignment across all rows.',
      'Keeps priority separate from typography, so the title stays readable.',
      'Scales better if more row metadata appears later.',
    ],
    cons: [
      'Can read as a divider if the color is too strong.',
      'Adds another color accent to a UI that already uses blue, red, yellow, and gray.',
    ],
  },
  {
    id: 'title-weight',
    title: 'Variant B — Priority via title weight',
    badge: 'Typography-only signal',
    summary: 'Urgent priority is expressed through a stronger title weight while the priority slot stays visually empty to preserve layout stability.',
    pros: [
      'Removes the extra colored marker from the row.',
      'Avoids the risk of looking like a visual separator.',
    ],
    cons: [
      'Adds typographic noise in dense lists.',
      'Can make urgent rows feel visually uneven, especially with long titles or done state styling.',
    ],
  },
  {
    id: 'neutral-soft-tail',
    title: 'Variant C — Muted neutral bar / softer tail',
    badge: 'Quiet structural marker',
    summary: 'Keeps the fixed slot and separate channel, but shifts the bar to a mostly neutral gray with only the faintest warm tint at the tail.',
    pros: [
      'Preserves alignment without introducing a strong new accent color.',
      'Feels closest to muted metadata rather than a warning state.',
      'Lowest risk of looking visually loud in dense lists.',
    ],
    cons: [
      'Urgent priority becomes easier to miss at a glance.',
      'Can start to feel decorative if softened too much.',
    ],
    recommended: true,
  },
  {
    id: 'neutral-clear-tail',
    title: 'Variant D — Muted neutral bar / clearer tail',
    badge: 'Slightly stronger discovery',
    summary: 'Still mostly neutral, but the tail keeps a bit more warmth so urgent rows remain easier to spot without going back to a bright yellow marker.',
    pros: [
      'More discoverable than the softer neutral tail.',
      'Still calmer than the original yellow bar.',
    ],
    cons: [
      'More warmth means a slightly stronger accent presence again.',
      'Needs review to ensure it does not drift back toward a warning cue.',
    ],
  },
  {
    id: 'soft-inset-bar',
    title: 'Variant E — Soft inset bar',
    badge: 'Inset structural marker',
    summary: 'A very quiet inset line that feels built into the slot rather than attached to the text or acting as a bright alert marker.',
    pros: [
      'Feels calmer and more integrated than a bright outer bar.',
      'Preserves alignment and keeps priority separate from typography.',
    ],
    cons: [
      'Can become too invisible if the contrast is reduced further.',
      'Needs careful tuning so it does not read as dead spacing.',
    ],
  },
  {
    id: 'dual-tone-neutral-bar',
    title: 'Variant F — Dual-tone neutral bar',
    badge: 'Segmented warm hint',
    summary: 'Mostly neutral gray with a small warm segment at the tail, but cleaner and more systematic than a full gradient.',
    pros: [
      'Simpler visual language than a full gradient bar.',
      'Keeps a small priority cue without turning the whole marker warm.',
    ],
    cons: [
      'The segmented look can feel slightly more designed than structural.',
      'Still carries some warm-tail accent risk.',
    ],
  },
  {
    id: 'micro-capsule',
    title: 'Variant G — Micro capsule',
    badge: 'Shape-first marker',
    summary: 'A tiny rounded capsule avoids the divider feeling of a full-height bar while keeping the priority signal outside the title.',
    pros: [
      'Less divider-like than a continuous line.',
      'Separate marker channel without typography noise.',
    ],
    cons: [
      'Smaller shape can be easier to miss in dense lists.',
      'If scaled up too much, it starts to feel decorative.',
    ],
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
  variant: Extract<PriorityPreviewVariant, 'neutral-soft-tail' | 'neutral-clear-tail'>;
}) {
  const isUrgent = task.priority === 'urgent';
  const isDone = task.status === 'done';
  const barColor = isDone ? 'color-mix(in srgb, var(--tt-text-soft) 44%, white)' : 'color-mix(in srgb, var(--tt-text-muted) 58%, white)';
  const barBorder = isDone
    ? 'color-mix(in srgb, var(--tt-text-soft) 28%, transparent)'
    : 'color-mix(in srgb, var(--tt-text-muted) 18%, transparent)';
  const warmTailColor = variant === 'neutral-soft-tail'
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
        color-mix(in srgb, ${barColor} ${variant === 'neutral-soft-tail' ? 80 : 66}%, ${warmTailColor}) 78%,
        color-mix(in srgb, ${barColor} ${variant === 'neutral-soft-tail' ? 40 : 22}%, ${warmTailColor}) 100%)`;

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

function SoftInsetPrioritySlotPreview({ task }: { task: PreviewTask }) {
  const isUrgent = task.priority === 'urgent';
  const isDone = task.status === 'done';
  const insetColor = isDone
    ? 'color-mix(in srgb, var(--tt-text-soft) 42%, white)'
    : 'color-mix(in srgb, var(--tt-text-muted) 54%, white)';

  return (
    <div className="mr-[5px] flex h-[40px] w-[10px] shrink-0 items-stretch justify-center py-[4px]" aria-hidden="true">
      {isUrgent && (
        <span
          className="inline-flex h-full w-[1.5px] rounded-full"
          style={{
            background: `linear-gradient(180deg,
              color-mix(in srgb, ${insetColor} 22%, transparent) 0%,
              color-mix(in srgb, ${insetColor} 58%, transparent) 28%,
              ${insetColor} 60%,
              color-mix(in srgb, ${insetColor} 38%, white) 100%)`,
            boxShadow: `inset 0 0 0 0.5px color-mix(in srgb, ${insetColor} 26%, transparent)`,
          }}
        />
      )}
    </div>
  );
}

function DualToneNeutralPrioritySlotPreview({ task }: { task: PreviewTask }) {
  const isUrgent = task.priority === 'urgent';
  const isDone = task.status === 'done';
  const baseColor = isDone
    ? 'color-mix(in srgb, var(--tt-text-soft) 46%, white)'
    : 'color-mix(in srgb, var(--tt-text-muted) 60%, white)';
  const warmSegment = 'color-mix(in srgb, #eed89a 34%, white)';

  return (
    <div className="mr-[5px] flex h-[40px] w-[10px] shrink-0 items-stretch justify-end py-[3px] pr-[1px]" aria-hidden="true">
      {isUrgent && (
        <span
          className="inline-flex h-full w-[2px] rounded-full"
          style={{
            background: isDone
              ? `linear-gradient(180deg,
                  color-mix(in srgb, ${baseColor} 20%, transparent) 0%,
                  ${baseColor} 56%,
                  color-mix(in srgb, ${baseColor} 40%, white) 100%)`
              : `linear-gradient(180deg,
                  color-mix(in srgb, ${baseColor} 18%, transparent) 0%,
                  ${baseColor} 72%,
                  ${warmSegment} 72%,
                  ${warmSegment} 100%)`,
            boxShadow: `0 0 0 0.5px color-mix(in srgb, ${baseColor} 24%, transparent)`,
          }}
        />
      )}
    </div>
  );
}

function MicroCapsulePrioritySlotPreview({ task }: { task: PreviewTask }) {
  const isUrgent = task.priority === 'urgent';
  const isDone = task.status === 'done';
  const capsuleColor = isDone
    ? 'color-mix(in srgb, var(--tt-text-soft) 42%, white)'
    : 'color-mix(in srgb, var(--tt-text-muted) 48%, white)';

  return (
    <div className="mr-[5px] flex h-[40px] w-[10px] shrink-0 items-start justify-end pt-[9px] pr-[1px]" aria-hidden="true">
      {isUrgent && (
        <span
          className="inline-flex h-[12px] w-[3px] rounded-full"
          style={{
            background: isDone
              ? `linear-gradient(180deg, ${capsuleColor} 0%, color-mix(in srgb, ${capsuleColor} 44%, white) 100%)`
              : `linear-gradient(180deg,
                  color-mix(in srgb, ${capsuleColor} 88%, white) 0%,
                  ${capsuleColor} 64%,
                  color-mix(in srgb, ${capsuleColor} 62%, #f0dda7) 100%)`,
            boxShadow: `0 0 0 0.5px color-mix(in srgb, ${capsuleColor} 22%, transparent)`,
          }}
        />
      )}
    </div>
  );
}

function PrioritySlotPreview({ variant, task }: { variant: PriorityPreviewVariant; task: PreviewTask }) {
  if (variant === 'bar') {
    return (
      <TaskMetaCluster
        showUrgentIndicator={task.priority === 'urgent'}
        status={task.status}
        visualVariant="legacy-bar"
      />
    );
  }

  if (variant === 'neutral-soft-tail' || variant === 'neutral-clear-tail') {
    return <NeutralPrioritySlotPreview task={task} variant={variant} />;
  }

  if (variant === 'soft-inset-bar') {
    return <SoftInsetPrioritySlotPreview task={task} />;
  }

  if (variant === 'dual-tone-neutral-bar') {
    return <DualToneNeutralPrioritySlotPreview task={task} />;
  }

  if (variant === 'micro-capsule') {
    return <MicroCapsulePrioritySlotPreview task={task} />;
  }

  return <div data-testid="preview-priority-slot" className="mr-[5px] h-[40px] w-[10px] shrink-0" aria-hidden="true" />;
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
  variant,
  task,
}: {
  variant: PriorityPreviewVariant;
  task: PreviewTask;
}) {
  const isDone = task.status === 'done';
  const isUrgent = task.priority === 'urgent';
  const showNote = Boolean(task.note);

  const titleStyle: React.CSSProperties = isDone
    ? {
        color: 'var(--tt-text-soft)',
        opacity: 0.9,
        fontWeight: variant === 'title-weight' && isUrgent ? 600 : 500,
      }
    : {
        color: 'var(--tt-text)',
        fontWeight: variant === 'title-weight' && isUrgent ? 650 : 500,
      };

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
          <PrioritySlotPreview variant={variant} task={task} />

          <div className="min-h-[40px] min-w-0 flex-1">
            <span
              className={`block min-w-0 truncate text-[15px] leading-5 ${isDone ? 'line-through' : ''}`}
              style={titleStyle}
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

function VariantCard({ variant }: { variant: VariantConfig }) {
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
            style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}
          >
            Preview focus
          </span>
        )}
      </div>

      <div className="space-y-3">
        {PREVIEW_TASKS.map((task) => (
          <PreviewTaskRow key={`${variant.id}-${task.id}`} variant={variant.id} task={task} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--tt-text)' }}>Pros</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            {variant.pros.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--tt-text)' }}>Trade-offs</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            {variant.cons.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function TaskRowPriorityPreview() {
  return (
    <main className="min-h-screen px-6 py-8" style={{ background: 'var(--tt-app-bg)' }}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>
            Task row priority preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold" style={{ color: 'var(--tt-text)' }}>
            Compare all urgent-priority treatments in one preview host
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            This route now collects every explored direction in one place: the separate yellow bar, the typography-only signal, the muted neutral bar micro-variants, and three additional structural marker concepts.
            It serves as a side-by-side visual review host for comparing these treatments alongside the current production behavior.
          </p>
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm leading-6"
            style={{
              borderColor: 'var(--tt-border)',
              background: 'var(--tt-surface)',
              color: 'var(--tt-text-muted)',
            }}
          >
            Preview URL: <code style={{ color: 'var(--tt-text)' }}>/preview/task-row-priority</code>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {VARIANTS.map((variant) => (
            <VariantCard key={variant.id} variant={variant} />
          ))}
        </div>

        <section
          className="mt-6 rounded-2xl border p-5"
          style={{
            background: 'var(--tt-surface-elevated)',
            borderColor: 'var(--tt-border)',
            boxShadow: 'var(--tt-shadow-soft)',
          }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--tt-text)' }}>
            What to compare across the whole set
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            <div>
              <strong style={{ color: 'var(--tt-text)' }}>Yellow bar</strong>
              <div>Best structural clarity, but carries the strongest accent and divider risk.</div>
            </div>
            <div>
              <strong style={{ color: 'var(--tt-text)' }}>Title weight</strong>
              <div>Quietest structurally, but adds typographic noise and can feel uneven in long lists.</div>
            </div>
            <div>
              <strong style={{ color: 'var(--tt-text)' }}>Neutral soft tail</strong>
              <div>Most restrained neutral option; safest if the goal is calm metadata over urgency.</div>
            </div>
            <div>
              <strong style={{ color: 'var(--tt-text)' }}>Neutral clear tail</strong>
              <div>Middle ground: calmer than yellow, more discoverable than the softer neutral tail.</div>
            </div>
            <div>
              <strong style={{ color: 'var(--tt-text)' }}>Soft inset bar</strong>
              <div>Most layout-native option if the goal is a marker that almost disappears into the slot.</div>
            </div>
            <div>
              <strong style={{ color: 'var(--tt-text)' }}>Dual-tone neutral bar</strong>
              <div>A more systematic version of the warm-tail idea, with a clearer segmented end.</div>
            </div>
            <div>
              <strong style={{ color: 'var(--tt-text)' }}>Micro capsule</strong>
              <div>Best if the main issue is the divider feeling of a full-height bar.</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}




