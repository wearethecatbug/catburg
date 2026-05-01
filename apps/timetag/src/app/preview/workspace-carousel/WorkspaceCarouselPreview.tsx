'use client';

import React from 'react';
import { createWorkspaceId } from '@/domain/workspace';
import { useCarouselNavigation } from '@/shared/hooks';

type PreviewVariantId =
  | 'edge-arrows'
  | 'pill-arrows'
  | 'embedded-arrows'
  | 'horizontal-flow'
  | 'wrapped-rail'
  | 'active-overflow'
  | 'dropdown-switcher';

interface VariantConfig {
  id: PreviewVariantId;
  title: string;
  badge: string;
  summary: string;
  notes: string[];
  mode: 'carousel' | 'flow' | 'wrapped' | 'overflow' | 'switcher';
}

interface WorkspaceItem {
  id: string;
  label: string;
}

const BASE_WORKSPACES: WorkspaceItem[] = [
  { id: 'all', label: 'All' },
  { id: 'work', label: 'Work' },
  { id: 'home', label: 'Home' },
  { id: 'focus', label: 'Focus' },
  { id: 'writing', label: 'Writing' },
  { id: 'ops', label: 'Ops' },
  { id: 'deep-research', label: 'Deep research' },
  { id: 'personal-admin', label: 'Personal admin' },
];

const VARIANTS: VariantConfig[] = [
  {
    id: 'edge-arrows',
    title: 'Variant A — Edge arrows',
    badge: 'Closest to current production direction',
    summary: 'Separate left/right arrow buttons frame the scroll zone. This keeps the carousel affordance explicit and makes overflow easy to discover.',
    notes: [
      'Strongest discoverability for hidden workspaces.',
      'Feels the most structured when many tabs exist.',
      'Slightly more UI chrome than the other variants.',
    ],
    mode: 'carousel',
  },
  {
    id: 'pill-arrows',
    title: 'Variant B — Soft pill arrows',
    badge: 'Lower visual noise',
    summary: 'The arrows stay outside the rail, but their treatment is lighter and more pill-like, so the carousel feels calmer while staying explicit.',
    notes: [
      'Better if the header already has many outlined controls.',
      'Still clearly signals scrolling.',
      'Good middle ground between clarity and softness.',
    ],
    mode: 'carousel',
  },
  {
    id: 'embedded-arrows',
    title: 'Variant C — Embedded rail arrows',
    badge: 'Most integrated chrome',
    summary: 'Arrow controls live inside the rail edges as overlays, which makes the whole strip feel more self-contained and compact.',
    notes: [
      'Most “component-like” and cohesive visually.',
      'Best when vertical space is tight.',
      'Needs careful contrast so arrows do not disappear into the rail.',
    ],
    mode: 'carousel',
  },
  {
    id: 'horizontal-flow',
    title: 'Variant D — Horizontal flow',
    badge: 'Minimal chrome / flow-first',
    summary: 'No explicit arrows. The strip behaves like a horizontal flow rail with wheel, trackpad, and direct drag-style scrolling as the primary interaction.',
    notes: [
      'Cleanest visual result when the goal is calm layout.',
      'Relies more on users noticing the overflow and edge fades.',
      'Best if you want workspaces to feel like a continuous ribbon rather than a carousel.',
    ],
    mode: 'flow',
  },
  {
    id: 'wrapped-rail',
    title: 'Variant E — Wrapped rail',
    badge: 'No hidden tabs / no scroll dependence',
    summary: 'The workspace strip becomes a wrapped chip rail. Nothing is hidden, the user never needs arrows, and the add slot stays detached on the right.',
    notes: [
      'Most honest option if discoverability matters more than constant bar height.',
      'Removes all carousel learning cost.',
      'Costs vertical space when many workspaces exist.',
    ],
    mode: 'wrapped',
  },
  {
    id: 'active-overflow',
    title: 'Variant F — Active + overflow',
    badge: 'Compact but still tab-like',
    summary: 'Show the active workspace prominently, keep one or two nearby quick targets, and collapse the rest into a +N overflow picker.',
    notes: [
      'Feels calmer than a full carousel while preserving fast access to the current context.',
      'Scales better once the workspace list grows.',
      'Needs a deliberate rule for which secondary workspaces stay visible.',
    ],
    mode: 'overflow',
  },
  {
    id: 'dropdown-switcher',
    title: 'Variant G — Dropdown switcher',
    badge: 'Menu-first workspace navigation',
    summary: 'A single switcher control replaces the whole tab rail. Workspace choice, add, and management happen from one consolidated control group.',
    notes: [
      'Best long-term scaling if workspace count can grow a lot.',
      'Very clean header; almost no navigation chrome.',
      'Least “tab-like”, so it changes the mental model the most.',
    ],
    mode: 'switcher',
  },
];

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'}
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function useWorkspacePreviewRail() {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [workspaces, setWorkspaces] = React.useState(BASE_WORKSPACES);
  const [activeId, setActiveId] = React.useState(BASE_WORKSPACES[1].id);
  const [isAdding, setIsAdding] = React.useState(false);
  const [draftName, setDraftName] = React.useState('');
  const [isActive, setIsActive] = React.useState(false);
  const {
    hasOverflow,
    canScrollLeft,
    canScrollRight,
    updateScrollState,
    scrollByStep,
    handleWheel,
    handleKeyDown,
  } = useCarouselNavigation({
    viewportRef,
    items: workspaces,
    activeId,
    onActiveChange: setActiveId,
  });

  React.useEffect(() => {
    updateScrollState();
  }, [isAdding, updateScrollState]);

  const handleAddToggle = React.useCallback(() => {
    setIsAdding((current) => !current);
    setDraftName('');
  }, []);

  const handleCancelAdd = React.useCallback(() => {
    setIsAdding(false);
    setDraftName('');
  }, []);

  const handleConfirmAdd = React.useCallback(() => {
    const label = draftName.trim();
    if (!label) {
      setIsAdding(false);
      return;
    }

    const id = createWorkspaceId(label);
    setWorkspaces((current) => {
      if (current.some((workspace) => workspace.id === id)) {
        return current;
      }

      return [...current, { id, label }];
    });
    setActiveId(id);
    setIsAdding(false);
    setDraftName('');
  }, [draftName]);

  return {
    viewportRef,
    workspaces,
    activeId,
    setActiveId,
    isAdding,
    draftName,
    setDraftName,
    hasOverflow,
    canScrollLeft,
    canScrollRight,
    isActive,
    setIsActive,
    scrollByStep,
    handleWheel,
    handleKeyDown,
    handleAddToggle,
    handleCancelAdd,
    handleConfirmAdd,
  };
}

function ArrowButton({
  direction,
  variant,
  enabled,
  onClick,
  active,
}: {
  direction: 'left' | 'right';
  variant: PreviewVariantId;
  enabled: boolean;
  onClick: () => void;
  active: boolean;
}) {
  const sharedProps = {
    type: 'button' as const,
    onClick,
    disabled: !enabled,
    'aria-label': `Scroll ${direction}`,
    title: `Scroll ${direction}`,
  };

  if (variant === 'pill-arrows') {
    return (
      <button
        {...sharedProps}
        className="inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)] disabled:cursor-default"
        style={{
          borderColor: 'color-mix(in srgb, var(--tt-border) 72%, transparent)',
          background: active ? 'var(--tt-surface-elevated)' : 'var(--tt-surface)',
          color: enabled ? 'var(--tt-text)' : 'var(--tt-text-soft)',
          opacity: enabled ? 1 : 0.38,
          transform: enabled && active ? 'translateY(-1px)' : undefined,
        }}
      >
        <ChevronIcon direction={direction} />
      </button>
    );
  }

  return (
    <button
      {...sharedProps}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)] disabled:cursor-default"
      style={{
        borderColor: 'var(--tt-border)',
        background: active ? 'var(--tt-surface-elevated)' : 'var(--tt-surface)',
        color: enabled ? 'var(--tt-text)' : 'var(--tt-text-soft)',
        opacity: enabled ? 1 : 0.42,
        transform: enabled && active ? 'translateY(-1px)' : undefined,
      }}
    >
      <ChevronIcon direction={direction} />
    </button>
  );
}

function WorkspaceActionSlot({
  isAdding,
  draftName,
  setDraftName,
  handleAddToggle,
  handleConfirmAdd,
  handleCancelAdd,
}: {
  isAdding: boolean;
  draftName: string;
  setDraftName: (value: string) => void;
  handleAddToggle: () => void;
  handleConfirmAdd: () => void;
  handleCancelAdd: () => void;
}) {
  if (!isAdding) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <button
          type="button"
          aria-label="Add workspace"
          title="Add workspace"
          onClick={handleAddToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-[var(--tt-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]"
          style={{ color: 'var(--tt-text-muted)' }}
        >
          <PlusIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-10 w-[15rem] shrink-0 items-center px-1">
      <div
        className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-xl border px-1.5 focus-within:ring-2 focus-within:ring-[var(--tt-ring)]"
        style={{
          borderColor: 'color-mix(in srgb, var(--tt-accent) 18%, var(--tt-border))',
          background: 'var(--tt-surface)',
        }}
      >
        <input
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleConfirmAdd();
            } else if (event.key === 'Escape') {
              handleCancelAdd();
            }
          }}
          placeholder="Workspace name"
          autoFocus
          className="h-full min-w-0 flex-1 border-none bg-transparent px-2 text-sm leading-5 focus-visible:outline-none"
          style={{ color: 'var(--tt-text)' }}
        />
        <button
          type="button"
          aria-label="Confirm add workspace"
          title="Add"
          onClick={handleConfirmAdd}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--tt-accent-soft)] focus-visible:outline-none"
          style={{ color: 'var(--tt-accent)' }}
        >
          <CheckIcon />
        </button>
        <button
          type="button"
          aria-label="Cancel add workspace"
          title="Cancel"
          onClick={handleCancelAdd}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--tt-surface-hover)] focus-visible:outline-none"
          style={{ color: 'var(--tt-text-soft)' }}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function WorkspaceRailPreview({ variant }: { variant: VariantConfig }) {
  const {
    viewportRef,
    workspaces,
    activeId,
    setActiveId,
    isAdding,
    draftName,
    setDraftName,
    hasOverflow,
    canScrollLeft,
    canScrollRight,
    isActive,
    setIsActive,
    scrollByStep,
    handleWheel,
    handleKeyDown,
    handleAddToggle,
    handleCancelAdd,
    handleConfirmAdd,
  } = useWorkspacePreviewRail();

  const isFlow = variant.mode === 'flow';
  const showOuterArrows = hasOverflow && !isFlow && variant.id !== 'embedded-arrows';
  const showEmbeddedArrows = hasOverflow && variant.id === 'embedded-arrows';

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
          <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>
            {variant.badge}
          </p>
          <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--tt-text)' }}>
            {variant.title}
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            {variant.summary}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
          style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}
        >
          Preview
        </span>
      </div>

      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface)' }}>
        <div className="flex items-stretch gap-2">
          {showOuterArrows ? (
            <ArrowButton
              direction="left"
              variant={variant.id}
              enabled={canScrollLeft}
              onClick={() => scrollByStep('left')}
              active={isActive}
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <div
              className="relative overflow-hidden rounded-2xl transition-[box-shadow,background-color] duration-200 focus-within:ring-2 focus-within:ring-[var(--tt-ring)]"
              style={{
                background: isActive ? 'color-mix(in srgb, var(--tt-surface-muted) 78%, var(--tt-surface) 22%)' : 'var(--tt-surface-muted)',
                boxShadow: hasOverflow || isActive
                  ? 'inset 0 0 0 1px color-mix(in srgb, var(--tt-border) 68%, transparent)'
                  : undefined,
              }}
              onMouseEnter={() => setIsActive(true)}
              onMouseLeave={() => setIsActive(false)}
            >
              {canScrollLeft ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8"
                  style={{ background: 'linear-gradient(90deg, var(--tt-surface-muted) 16%, transparent 100%)' }}
                />
              ) : null}
              {canScrollRight ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8"
                  style={{ background: 'linear-gradient(270deg, var(--tt-surface-muted) 16%, transparent 100%)' }}
                />
              ) : null}

              {showEmbeddedArrows ? (
                <div className="pointer-events-none absolute inset-y-0 left-2 z-20 flex items-center">
                  <button
                    type="button"
                    onClick={() => scrollByStep('left')}
                    disabled={!canScrollLeft}
                    aria-label="Scroll left"
                    className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)] disabled:cursor-default"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--tt-border) 74%, transparent)',
                      background: 'color-mix(in srgb, var(--tt-surface) 74%, transparent)',
                      color: canScrollLeft ? 'var(--tt-text)' : 'var(--tt-text-soft)',
                      opacity: canScrollLeft ? 1 : 0.38,
                    }}
                  >
                    <ChevronIcon direction="left" />
                  </button>
                </div>
              ) : null}

              {showEmbeddedArrows ? (
                <div className="pointer-events-none absolute inset-y-0 right-2 z-20 flex items-center">
                  <button
                    type="button"
                    onClick={() => scrollByStep('right')}
                    disabled={!canScrollRight}
                    aria-label="Scroll right"
                    className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)] disabled:cursor-default"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--tt-border) 74%, transparent)',
                      background: 'color-mix(in srgb, var(--tt-surface) 74%, transparent)',
                      color: canScrollRight ? 'var(--tt-text)' : 'var(--tt-text-soft)',
                      opacity: canScrollRight ? 1 : 0.38,
                    }}
                  >
                    <ChevronIcon direction="right" />
                  </button>
                </div>
              ) : null}

              <div
                ref={viewportRef}
                className={`flex items-stretch overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isFlow ? 'gap-2 px-2 py-2' : ''}`}
                tabIndex={0}
                onWheel={handleWheel}
                onFocus={() => setIsActive(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsActive(false);
                  }
                }}
                onKeyDown={handleKeyDown}
              >
                {workspaces.map((workspace) => {
                  const selected = activeId === workspace.id;
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      data-workspace-id={workspace.id}
                      aria-pressed={selected}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => setActiveId(workspace.id)}
                      className={isFlow
                        ? 'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors'
                        : 'shrink-0 border-b-2 px-4 text-sm font-medium transition-colors'}
                      style={isFlow
                        ? {
                            borderColor: selected ? 'var(--tt-accent)' : 'var(--tt-border)',
                            background: selected ? 'var(--tt-accent-soft)' : 'var(--tt-surface)',
                            color: selected ? 'var(--tt-accent)' : 'var(--tt-text-muted)',
                          }
                        : selected
                          ? { borderColor: 'var(--tt-accent)', color: 'var(--tt-accent)', height: 40 }
                          : { borderColor: 'transparent', color: 'var(--tt-text-muted)', height: 40 }}
                    >
                      <span className="whitespace-nowrap">{workspace.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {showOuterArrows ? (
            <ArrowButton
              direction="right"
              variant={variant.id}
              enabled={canScrollRight}
              onClick={() => scrollByStep('right')}
              active={isActive}
            />
          ) : null}

          <WorkspaceActionSlot
            isAdding={isAdding}
            draftName={draftName}
            setDraftName={setDraftName}
            handleAddToggle={handleAddToggle}
            handleConfirmAdd={handleConfirmAdd}
            handleCancelAdd={handleCancelAdd}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
        {variant.notes.map((note) => (
          <div key={note}>• {note}</div>
        ))}
      </div>
    </section>
  );
}

function WrappedRailPreview({ variant }: { variant: VariantConfig }) {
  const {
    workspaces,
    activeId,
    setActiveId,
    isAdding,
    draftName,
    setDraftName,
    handleAddToggle,
    handleCancelAdd,
    handleConfirmAdd,
  } = useWorkspacePreviewRail();

  return (
    <section className="rounded-2xl border p-5" style={{ background: 'var(--tt-surface-elevated)', borderColor: 'var(--tt-border)', boxShadow: 'var(--tt-shadow-soft)' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>{variant.badge}</p>
          <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--tt-text)' }}>{variant.title}</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>{variant.summary}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide" style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}>Preview</span>
      </div>

      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface)' }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 rounded-2xl p-2" style={{ background: 'var(--tt-surface-muted)' }}>
            <div className="flex flex-wrap gap-2">
              {workspaces.map((workspace) => {
                const selected = activeId === workspace.id;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    aria-pressed={selected}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => setActiveId(workspace.id)}
                    className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      borderColor: selected ? 'var(--tt-accent)' : 'var(--tt-border)',
                      background: selected ? 'var(--tt-accent-soft)' : 'var(--tt-surface)',
                      color: selected ? 'var(--tt-accent)' : 'var(--tt-text-muted)',
                    }}
                  >
                    {workspace.label}
                  </button>
                );
              })}
            </div>
          </div>

          <WorkspaceActionSlot
            isAdding={isAdding}
            draftName={draftName}
            setDraftName={setDraftName}
            handleAddToggle={handleAddToggle}
            handleConfirmAdd={handleConfirmAdd}
            handleCancelAdd={handleCancelAdd}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
        {variant.notes.map((note) => <div key={note}>• {note}</div>)}
      </div>
    </section>
  );
}

function ActiveOverflowPreview({ variant }: { variant: VariantConfig }) {
  const {
    workspaces,
    activeId,
    setActiveId,
    isAdding,
    draftName,
    setDraftName,
    handleAddToggle,
    handleCancelAdd,
    handleConfirmAdd,
  } = useWorkspacePreviewRail();
  const [isOverflowOpen, setIsOverflowOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const overflowPanelId = `workspace-overflow-panel-${variant.id}`;

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0];
  const secondaryWorkspaces = workspaces.filter((workspace) => workspace.id !== activeId).slice(0, 2);
  const hiddenWorkspaces = workspaces.filter((workspace) => workspace.id !== activeId).slice(2);

  React.useEffect(() => {
    if (!isOverflowOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsOverflowOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOverflowOpen]);

  return (
    <section className="rounded-2xl border p-5" style={{ background: 'var(--tt-surface-elevated)', borderColor: 'var(--tt-border)', boxShadow: 'var(--tt-shadow-soft)' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>{variant.badge}</p>
          <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--tt-text)' }}>{variant.title}</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>{variant.summary}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide" style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}>Preview</span>
      </div>

      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface)' }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 rounded-2xl p-2" style={{ background: 'var(--tt-surface-muted)' }}>
            <div ref={popoverRef} className="relative flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--tt-accent)', background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}
                onClick={() => setActiveId(activeWorkspace.id)}
              >
                {activeWorkspace.label}
              </button>

              {secondaryWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => setActiveId(workspace.id)}
                  className="rounded-full border px-3.5 py-2 text-sm font-medium transition-colors"
                  style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface)', color: 'var(--tt-text-muted)' }}
                >
                  {workspace.label}
                </button>
              ))}

              {hiddenWorkspaces.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsOverflowOpen((current) => !current)}
                  aria-expanded={isOverflowOpen}
                  aria-controls={overflowPanelId}
                  className="rounded-full border px-3.5 py-2 text-sm font-medium transition-colors"
                  style={{ borderColor: 'var(--tt-border)', background: isOverflowOpen ? 'var(--tt-surface-elevated)' : 'var(--tt-surface)', color: 'var(--tt-text)' }}
                >
                  +{hiddenWorkspaces.length}
                </button>
              ) : null}

              {isOverflowOpen ? (
                <div
                  id={overflowPanelId}
                  className="absolute left-0 top-full z-20 mt-2 w-[14rem] rounded-2xl border p-2"
                  style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface-elevated)', boxShadow: 'var(--tt-shadow)' }}
                >
                  <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--tt-text-soft)' }}>
                    More workspaces
                  </div>
                  <div className="space-y-1">
                    {hiddenWorkspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        type="button"
                        onClick={() => {
                          setActiveId(workspace.id);
                          setIsOverflowOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--tt-surface-hover)]"
                        style={{ color: 'var(--tt-text)' }}
                      >
                        <span>{workspace.label}</span>
                        <ChevronDownIcon />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <WorkspaceActionSlot
            isAdding={isAdding}
            draftName={draftName}
            setDraftName={setDraftName}
            handleAddToggle={handleAddToggle}
            handleConfirmAdd={handleConfirmAdd}
            handleCancelAdd={handleCancelAdd}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
        {variant.notes.map((note) => <div key={note}>• {note}</div>)}
      </div>
    </section>
  );
}

function DropdownSwitcherPreview({ variant }: { variant: VariantConfig }) {
  const {
    workspaces,
    activeId,
    setActiveId,
    isAdding,
    draftName,
    setDraftName,
    handleAddToggle,
    handleCancelAdd,
    handleConfirmAdd,
  } = useWorkspacePreviewRail();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const switcherPanelId = `workspace-switcher-panel-${variant.id}`;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0];

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <section className="rounded-2xl border p-5" style={{ background: 'var(--tt-surface-elevated)', borderColor: 'var(--tt-border)', boxShadow: 'var(--tt-shadow-soft)' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>{variant.badge}</p>
          <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--tt-text)' }}>{variant.title}</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>{variant.summary}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide" style={{ background: 'var(--tt-accent-soft)', color: 'var(--tt-accent)' }}>Preview</span>
      </div>

      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface)' }}>
        <div className="flex items-start gap-3">
          <div ref={dropdownRef} className="relative min-w-0 flex-1 rounded-2xl p-2" style={{ background: 'var(--tt-surface-muted)' }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-expanded={isOpen}
                aria-controls={switcherPanelId}
                className="inline-flex min-w-[12rem] items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]"
                style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface)', color: 'var(--tt-text)' }}
              >
                <span className="truncate">Workspace: {activeWorkspace.label}</span>
                <ChevronDownIcon />
              </button>
              <span className="text-xs" style={{ color: 'var(--tt-text-soft)' }}>Use one switcher instead of a persistent tab rail.</span>
            </div>

            {isOpen ? (
              <div
                id={switcherPanelId}
                className="absolute left-2 top-full z-20 mt-2 w-[16rem] rounded-2xl border p-2"
                style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface-elevated)', boxShadow: 'var(--tt-shadow)' }}
              >
                <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--tt-text-soft)' }}>
                  Switch workspace
                </div>
                <div className="space-y-1">
                  {workspaces.map((workspace) => {
                    const selected = workspace.id === activeId;
                    return (
                      <button
                        key={workspace.id}
                        type="button"
                        aria-pressed={selected}
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => {
                          setActiveId(workspace.id);
                          setIsOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--tt-surface-hover)]"
                        style={{
                          background: selected ? 'var(--tt-accent-soft)' : 'transparent',
                          color: selected ? 'var(--tt-accent)' : 'var(--tt-text)',
                        }}
                      >
                        <span>{workspace.label}</span>
                        {selected ? <CheckIcon /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <WorkspaceActionSlot
            isAdding={isAdding}
            draftName={draftName}
            setDraftName={setDraftName}
            handleAddToggle={handleAddToggle}
            handleConfirmAdd={handleConfirmAdd}
            handleCancelAdd={handleCancelAdd}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
        {variant.notes.map((note) => <div key={note}>• {note}</div>)}
      </div>
    </section>
  );
}

export default function WorkspaceCarouselPreview() {
  return (
    <main className="min-h-screen px-6 py-8" style={{ background: 'var(--tt-app-bg)' }}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--tt-accent)' }}>
            Workspace navigation preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold" style={{ color: 'var(--tt-text)' }}>
            Compare carousel patterns, wrapped rails, and switcher-first workspace navigation
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--tt-text-muted)' }}>
            This preview host now compares two classes of ideas: classic carousel treatments and alternative workspace models that avoid the carousel problem entirely.
            The newer concepts include a wrapped rail, an active-plus-overflow model, and a single dropdown switcher so the trade-offs can be compared side by side.
          </p>
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm leading-6"
            style={{
              borderColor: 'var(--tt-border)',
              background: 'var(--tt-surface)',
              color: 'var(--tt-text-muted)',
            }}
          >
            Preview URL: <code style={{ color: 'var(--tt-text)' }}>/preview/workspace-carousel</code>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          {VARIANTS.map((variant) => {
            if (variant.mode === 'wrapped') {
              return <WrappedRailPreview key={variant.id} variant={variant} />;
            }

            if (variant.mode === 'overflow') {
              return <ActiveOverflowPreview key={variant.id} variant={variant} />;
            }

            if (variant.mode === 'switcher') {
              return <DropdownSwitcherPreview key={variant.id} variant={variant} />;
            }

            return <WorkspaceRailPreview key={variant.id} variant={variant} />;
          })}
        </div>
      </div>
    </main>
  );
}


