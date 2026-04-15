'use client';

import React from 'react';
import { NoteIcon } from '@/shared';

type VariantId = 'soft-inset' | 'balanced-inset' | 'accent-inset';
type SelectVisualState = 'idle' | 'hover' | 'checked';
type DoneVisualState = 'idle' | 'hover' | 'done' | 'done-hover';

interface VariantConfig {
  id: VariantId;
  title: string;
  caption: string;
  recommended?: boolean;
  outerIdleBorder: string;
  outerIdleBackground: string;
  outerHoverBorder: string;
  outerHoverBackground: string;
  outerCheckedBorder: string;
  outerCheckedBackground: string;
  innerIdleBorder: string;
  innerHoverBorder: string;
  innerCheckedBorder: string;
  innerIdleFill: string;
  innerHoverFill: string;
  innerCheckedFill: string;
  borderRadius: number;
  borderWidth: number;
  outerShadow?: string;
}

const VARIANTS: VariantConfig[] = [
  {
    id: 'soft-inset',
    title: 'Variant A — Soft inset',
    caption: 'Самый тихий вариант: мягкое внутреннее кольцо, минимальный синий акцент, почти не спорит с done.',
    outerIdleBorder: 'var(--tt-border-strong)',
    outerIdleBackground: 'rgba(255,255,255,0.52)',
    outerHoverBorder: 'var(--tt-accent)',
    outerHoverBackground: 'var(--tt-accent-soft)',
    outerCheckedBorder: 'var(--tt-accent)',
    outerCheckedBackground: 'rgba(79, 125, 243, 0.14)',
    innerIdleBorder: 'rgba(148, 163, 184, 0.58)',
    innerHoverBorder: 'rgba(100, 116, 139, 0.72)',
    innerCheckedBorder: 'rgba(79, 125, 243, 0.72)',
    innerIdleFill: 'rgba(255, 255, 255, 0.66)',
    innerHoverFill: 'rgba(255, 255, 255, 0.8)',
    innerCheckedFill: 'rgba(245, 248, 255, 0.9)',
    borderRadius: 4,
    borderWidth: 1.5,
  },
  {
    id: 'balanced-inset',
    title: 'Variant B — Balanced inset',
    caption: 'Наиболее собранный вариант: читаемый центр, аккуратный hover и хорошее разделение ролей между select и done.',
    recommended: true,
    outerIdleBorder: 'rgba(215, 222, 231, 0.78)',
    outerIdleBackground: 'rgba(255,255,255,0.30)',
    outerHoverBorder: 'rgba(79, 125, 243, 0.76)',
    outerHoverBackground: 'rgba(79, 125, 243, 0.04)',
    outerCheckedBorder: 'rgba(79, 125, 243, 0.82)',
    outerCheckedBackground: 'rgba(79, 125, 243, 0.11)',
    innerIdleBorder: 'rgba(71, 85, 105, 0.76)',
    innerHoverBorder: 'rgba(51, 65, 85, 0.84)',
    innerCheckedBorder: 'rgba(63, 106, 224, 0.9)',
    innerIdleFill: 'rgba(255, 255, 255, 0.68)',
    innerHoverFill: 'rgba(255, 255, 255, 0.82)',
    innerCheckedFill: 'rgba(245, 248, 255, 0.92)',
    borderRadius: 4,
    borderWidth: 1,
    outerShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
  },
  {
    id: 'accent-inset',
    title: 'Variant C — Accent inset',
    caption: 'Самый выразительный вариант: внутреннее кольцо сильнее подчёркнуто. Полезен, если нужен более заметный select.',
    outerIdleBorder: 'rgba(148, 163, 184, 0.9)',
    outerIdleBackground: 'rgba(255,255,255,0.62)',
    outerHoverBorder: 'var(--tt-accent-hover)',
    outerHoverBackground: 'rgba(79, 125, 243, 0.15)',
    outerCheckedBorder: 'var(--tt-accent-hover)',
    outerCheckedBackground: 'rgba(79, 125, 243, 0.20)',
    innerIdleBorder: 'rgba(100, 116, 139, 0.82)',
    innerHoverBorder: 'rgba(79, 125, 243, 0.76)',
    innerCheckedBorder: 'var(--tt-accent)',
    innerIdleFill: 'rgba(255, 255, 255, 0.72)',
    innerHoverFill: 'rgba(255, 255, 255, 0.84)',
    innerCheckedFill: 'rgba(245, 248, 255, 0.94)',
    borderRadius: 5,
    borderWidth: 1.5,
    outerShadow: '0 1px 2px rgba(79, 125, 243, 0.08)',
  },
];

const DISPLAY_VARIANTS = [...VARIANTS].sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended)));

interface CheckboxPreviewProps {
  variant: VariantConfig;
  state: SelectVisualState;
}

function CheckboxPreview({ variant, state }: CheckboxPreviewProps) {
  const isHover = state === 'hover';
  const isChecked = state === 'checked';

  const borderColor = isChecked
    ? variant.outerCheckedBorder
    : isHover
      ? variant.outerHoverBorder
      : variant.outerIdleBorder;

  const background = isChecked
    ? variant.outerCheckedBackground
    : isHover
      ? variant.outerHoverBackground
      : variant.outerIdleBackground;

  const innerBorderColor = isChecked
    ? variant.innerCheckedBorder
    : isHover
      ? variant.innerHoverBorder
      : variant.innerIdleBorder;

  const innerFill = isChecked
    ? variant.innerCheckedFill
    : isHover
      ? variant.innerHoverFill
      : variant.innerIdleFill;

  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center transition-all duration-150 ease-out"
      style={{
        width: 18,
        height: 18,
        borderRadius: variant.borderRadius,
        border: `${variant.borderWidth}px solid ${borderColor}`,
        background,
        boxShadow: variant.outerShadow,
      }}
    >
      <span
        className="transition-all duration-150 ease-out"
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          border: `1px solid ${innerBorderColor}`,
          background: innerFill,
          opacity: isChecked ? 1 : isHover ? 0.94 : 0.84,
          transform: isChecked ? 'scale(1)' : isHover ? 'scale(0.94)' : 'scale(0.9)',
        }}
      />
    </span>
  );
}

function DoneButtonPreview({ state }: { state: DoneVisualState }) {
  const isDone = state === 'done' || state === 'done-hover';
  const isHover = state === 'hover' || state === 'done-hover';
  const hoverBorderColor = 'rgba(79, 125, 243, 0.72)';

  const borderColor = isDone
    ? isHover
      ? hoverBorderColor
      : 'var(--tt-accent)'
    : isHover
      ? hoverBorderColor
      : 'var(--tt-border-strong)';

  const background = isDone
    ? isHover
      ? 'rgba(79, 125, 243, 0.88)'
      : 'var(--tt-accent)'
    : isHover
      ? 'rgba(79, 125, 243, 0.06)'
      : 'var(--tt-surface)';

  const color = isDone
    ? 'var(--tt-accent-contrast)'
    : isHover
      ? 'var(--tt-accent)'
      : 'rgba(79, 125, 243, 0)';

  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ease-out"
      style={{
        borderColor,
        borderWidth: isHover ? 1 : 2,
        background,
        color,
        boxShadow: 'none',
        transform: isHover ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none">
        <path
          d="M5.75 12.5l4 4L18.25 8.5"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function MetadataPreview() {
  return (
    <span className="pointer-events-none mr-[10px] inline-flex h-5 shrink-0 items-center gap-1.5 self-center" aria-hidden="true">
      <span className="inline-flex h-4 w-4 items-center justify-center" style={{ color: '#F59E0B', opacity: 0.9 }}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none">
          <path
            d="M12 3.5L20.4 18.6A1.2 1.2 0 0119.35 20.4H4.65A1.2 1.2 0 013.6 18.6L12 3.5z"
            fill="#FFFFFF"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M12 8.1v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="17.2" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <span className="inline-flex h-4 w-4 items-center justify-center" style={{ color: '#9CA3AF', opacity: 0.6 }}>
        <NoteIcon size="sm" />
      </span>
    </span>
  );
}

interface PreviewRowProps {
  variant: VariantConfig;
  title: string;
  caption: string;
  selectState: SelectVisualState;
  doneState: DoneVisualState;
  selectedRow?: boolean;
}

function PreviewRow({
  variant,
  title,
  caption,
  selectState,
  doneState,
  selectedRow = false,
}: PreviewRowProps) {
  const isDone = doneState === 'done' || doneState === 'done-hover';

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: selectedRow ? 'rgba(59,130,246,0.03)' : 'var(--tt-surface)',
        boxShadow: selectedRow
          ? 'inset 0 0 0 1px rgba(59, 130, 246, 0.08)'
          : 'inset 0 0 0 1px var(--tt-border)',
      }}
    >
      <CheckboxPreview variant={variant} state={selectState} />
      <DoneButtonPreview state={doneState} />
      <MetadataPreview />
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[15px] font-medium leading-5 ${isDone ? 'line-through' : ''}`}
          style={{ color: isDone ? '#94A3B8' : 'var(--tt-text)' }}
        >
          {title}
        </div>
        <div className="mt-1 text-[12px] leading-[1.3]" style={{ color: 'var(--tt-text-soft)' }}>
          {caption}
        </div>
      </div>
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
          <h2 className="text-base font-semibold" style={{ color: 'var(--tt-text)' }}>{variant.title}</h2>
          <p className="mt-1 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>{variant.caption}</p>
        </div>
        {variant.recommended && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
            style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}
          >
            Selected
          </span>
        )}
      </div>

      <div className="space-y-3">
        <PreviewRow
          variant={variant}
          title="Idle row"
          caption="Нейтральный select с тонким внутренним кольцом; done ещё не просит внимания."
          selectState="idle"
          doneState="idle"
        />
        <PreviewRow
          variant={variant}
          title="Select hover"
          caption="Внешняя рамка уходит в accent, внутренний квадрат становится заметнее, но остаётся полым."
          selectState="hover"
          doneState="idle"
        />
        <PreviewRow
          variant={variant}
          title="Selected task"
          caption="Select выбран, строка мягко подсвечена, done остаётся вторым действием."
          selectState="checked"
          doneState="hover"
          selectedRow
        />
        <PreviewRow
          variant={variant}
          title="Done hover"
          caption="Hover у done показывает действие легче: более тонкая и мягкая синяя рамка, лёгкий фон и без дополнительной тени."
          selectState="idle"
          doneState="hover"
        />
        <PreviewRow
          variant={variant}
          title="Completed task"
          caption="Активный done на hover остаётся читаемым, но становится легче и не утяжеляется тенью."
          selectState="idle"
          doneState="done-hover"
        />
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
        Что сравнивать при выборе
      </h2>
      <ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
        <li>
          <strong style={{ color: 'var(--tt-text)' }}>Variant A</strong> — самый спокойный. Подойдёт, если важно сохранить почти невидимый utility-control.
        </li>
        <li>
          <strong style={{ color: 'var(--tt-text)' }}>Variant B</strong> — лучший баланс. Внутренний квадрат читается, но select остаётся слабее, чем круглый done.
        </li>
        <li>
          <strong style={{ color: 'var(--tt-text)' }}>Текущая правка</strong> — у selected-marker теперь полый внутренний квадрат, а hover у done стал мягче, тоньше и без тени.
        </li>
        <li>
          <strong style={{ color: 'var(--tt-text)' }}>Variant C</strong> — уже заметный акцент. Хорош, если select нужен более явным, но есть риск конкуренции с done.
        </li>
      </ul>
      <div
        className="mt-5 rounded-xl border px-4 py-3 text-sm leading-6"
        style={{
          borderColor: 'var(--tt-border)',
          background: 'var(--tt-surface)',
          color: 'var(--tt-text-muted)',
        }}
      >
        Для текущей задачи выбран <strong style={{ color: 'var(--tt-text)' }}>Variant B</strong>: он лучше всего поддерживает идею
        «select = вторичный control, done = главный статусный action» и уже синхронизирован с рабочими контролами списка задач.
      </div>
    </section>
  );
}

export default function SelectCheckboxPreview() {
  return (
    <main className="min-h-screen px-6 py-8" style={{ background: 'var(--tt-app-bg)' }}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>
            Task row controls preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold" style={{ color: 'var(--tt-text)' }}>
            Variant B selected for task row controls
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            Итоговое направление — <strong style={{ color: 'var(--tt-text)' }}>Variant B / Balanced inset</strong>. Ниже он показан первым и
            помечен как выбранный, а альтернативы оставлены для быстрого визуального сравнения в контексте строки задачи.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-3">
          {DISPLAY_VARIANTS.map((variant) => (
            <VariantCard key={variant.id} variant={variant} />
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section
            className="rounded-2xl border p-5"
            style={{
              background: 'var(--tt-surface-elevated)',
              borderColor: 'var(--tt-border)',
              boxShadow: 'var(--tt-shadow-soft)',
            }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--tt-text)' }}>
              Variant B done button interaction study
            </h2>
            <p className="mt-1 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
              Отдельно сравниваем смысловые состояния кнопки done: idle, hover до завершения и hover после завершения.
            </p>
            <div className="mt-4 space-y-3">
              <PreviewRow
                variant={VARIANTS[1]}
                title="Done idle"
                caption="Нейтральная окружность без сильного акцента — control доступен, но не шумит."
                selectState="idle"
                doneState="idle"
              />
              <PreviewRow
                variant={VARIANTS[1]}
                title="Done hover before completion"
                caption="Hover раскрывает действие мягче: более тонкая неяркая рамка, лёгкий фон, галочка-подсказка и без тени."
                selectState="idle"
                doneState="hover"
              />
              <PreviewRow
                variant={VARIANTS[1]}
                title="Done hover after completion"
                caption="После завершения hover слегка смягчает заливку, сохраняя читаемый контраст галочки."
                selectState="checked"
                doneState="done-hover"
                selectedRow
              />
            </div>
          </section>

          <RationaleCard />
        </div>
      </div>
    </main>
  );
}


