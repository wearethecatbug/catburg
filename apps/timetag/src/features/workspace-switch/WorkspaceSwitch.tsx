'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { AssignableWorkspaceType } from '@/domain/task.types';
import {
  ALL_WORKSPACE_TAB,
  createWorkspaceId,
  type WorkspaceTab,
} from '@/domain/workspace';
import { useSettings, useTasks } from '@/store';
import { AppContentContainer, Dropdown, DropdownItem, useCarouselNavigation, usePersistedWorkspaces } from '@/shared';

const WORKSPACE_SELECTOR_WIDTH = 'calc(8ch + 4.5rem)';

type WorkspaceAddButtonVariant = 'air-ghost' | 'soft-chip' | 'minimal-inline';

function getWorkspaceAddButtonVariant(contentWidthMode: 'compact' | 'comfortable' | 'wide'): WorkspaceAddButtonVariant {
  if (contentWidthMode === 'compact') {
    return 'minimal-inline';
  }

  if (contentWidthMode === 'wide') {
    return 'soft-chip';
  }

  return 'air-ghost';
}

/**
 * WorkspaceSwitch — renders user-manageable workspace tabs + All + add-button.
 * Workspaces list persisted to localStorage so user changes survive reloads.
 */
export function WorkspaceSwitch() {
  const { state, setWorkspace } = useTasks();
  const { settings, updateGeneral } = useSettings();
  const { workspaces: userWorkspaces, setWorkspaces: setUserWorkspaces } = usePersistedWorkspaces();
  const tabsViewportRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the initial client render aligned with SSR output to avoid a tab flash.
  const [isMounted, setIsMounted] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // State for inline add input
  const [isAdding, setIsAdding] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCarouselActive, setIsCarouselActive] = useState(false);


  // Combined tabs for rendering: All tab first, then user tabs (order preserved)
  const tabs = React.useMemo(() => [ALL_WORKSPACE_TAB, ...userWorkspaces], [userWorkspaces]);
  const {
    hasOverflow: hasHorizontalOverflow,
    canScrollLeft,
    canScrollRight,
    updateScrollState,
    scheduleFocusItem: scheduleFocusWorkspaceTab,
    handleWheel: handleViewportWheel,
    handleKeyDown: handleViewportKeyDown,
  } = useCarouselNavigation({
    viewportRef: tabsViewportRef,
    items: tabs,
    activeId: state.workspace,
    onActiveChange: setWorkspace,
    isEnabled: isMounted,
    focusOnActiveChange: false,
  });

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    updateScrollState();
  }, [isAdding, isMounted, updateScrollState]);
  const canRemoveWorkspace = userWorkspaces.length > 1;
  const activeWorkspaceLabel = tabs.find((workspace) => workspace.id === state.workspace)?.label ?? ALL_WORKSPACE_TAB.label;
  const addWorkspaceVariant = getWorkspaceAddButtonVariant(settings.appearance.contentWidthMode);
  const addWorkspaceSlotClassName = addWorkspaceVariant === 'soft-chip' ? 'w-12' : addWorkspaceVariant === 'minimal-inline' ? 'w-9' : 'w-10';
  const addWorkspaceButtonClassName = addWorkspaceVariant === 'soft-chip'
    ? 'inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-full border px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]'
    : addWorkspaceVariant === 'minimal-inline'
      ? 'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]'
      : 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-ring)]';
  const addWorkspaceButtonStyle = addWorkspaceVariant === 'soft-chip'
    ? {
        color: 'var(--tt-text-muted)',
        borderColor: 'color-mix(in srgb, var(--tt-border) 82%, transparent)',
        background: 'color-mix(in srgb, var(--tt-surface) 86%, transparent)',
      }
    : addWorkspaceVariant === 'minimal-inline'
      ? {
          color: 'var(--tt-text-soft)',
          background: 'transparent',
        }
      : {
          color: 'var(--tt-text-muted)',
          background: 'transparent',
        };

  const handleWorkspaceSelectFromDropdown = useCallback((workspaceId: AssignableWorkspaceType | 'all') => {
    setWorkspace(workspaceId);
    setSelectorOpen(false);
    scheduleFocusWorkspaceTab(workspaceId);
  }, [scheduleFocusWorkspaceTab, setWorkspace]);

  // Toggle add input
  const handleToggleAdd = useCallback(() => {
    setIsAdding((prev) => !prev);
    setNewWorkspaceName('');
  }, []);

  // Confirm add workspace
  const handleConfirmAdd = useCallback(() => {
    const label = newWorkspaceName.trim();
    if (!label) {
      setIsAdding(false);
      return;
    }
    const id = createWorkspaceId(label);
    // avoid duplicates
    if (userWorkspaces.some((w) => w.id === id)) {
      alert('Workspace with similar name already exists.');
      return;
    }
    const next: WorkspaceTab[] = [...userWorkspaces, { id, label }];
    setUserWorkspaces(next);
    // switch to new workspace immediately
    setWorkspace(id);
    // reset state
    setIsAdding(false);
    setNewWorkspaceName('');
  }, [newWorkspaceName, userWorkspaces, setUserWorkspaces, setWorkspace]);

  // Cancel add
  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
    setNewWorkspaceName('');
  }, []);

  // Handle Enter key in input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirmAdd();
    } else if (e.key === 'Escape') {
      handleCancelAdd();
    }
  }, [handleConfirmAdd, handleCancelAdd]);

  // Remove workspace (only from userWorkspaces, cannot remove 'all')
  const handleRemove = useCallback(
      (id: AssignableWorkspaceType) => {
        if (userWorkspaces.length <= 1) {
          return;
        }

        const next = userWorkspaces.filter((w) => w.id !== id);
        setUserWorkspaces(next);
        // if removed one was active, fallback to 'all'
        if (state.workspace === id) {
          setWorkspace('all');
        }

        if (settings.general.defaultWorkspace === id && next[0]) {
          updateGeneral({ defaultWorkspace: next[0].id });
        }
      },
      [settings.general.defaultWorkspace, setUserWorkspaces, setWorkspace, state.workspace, updateGeneral, userWorkspaces],
  );

  return (
      <div
        className="relative z-30 border-b"
        style={{
          borderColor: 'var(--tt-border)',
          background: 'var(--tt-surface-muted)',
          backdropFilter: 'blur(16px) saturate(1.06)',
        }}
      >
        <AppContentContainer>
          <div className="flex items-stretch gap-2 px-2">
            {!isMounted ? (
            // Skeleton loader during SSR/initial mount to prevent flash
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-stretch overflow-hidden">
                  <div className="h-10 w-16 animate-pulse rounded px-4 py-2" style={{ background: 'var(--tt-surface-subtle)' }} />
                  <div className="ml-2 h-10 w-16 animate-pulse rounded px-4 py-2" style={{ background: 'var(--tt-surface-subtle)' }} />
                </div>
              </div>
              <div className="h-10 w-10 animate-pulse rounded-lg" style={{ background: 'var(--tt-surface-subtle)' }} />
            </>
            ) : (
            <>
              <div className="min-w-0 flex-1">
                <div
                  className="relative overflow-hidden rounded-2xl transition-[box-shadow,background-color] duration-200 focus-within:ring-2 focus-within:ring-[var(--tt-ring)]"
                  style={{
                    background: isCarouselActive ? 'color-mix(in srgb, var(--tt-surface-muted) 78%, var(--tt-surface) 22%)' : 'var(--tt-surface-muted)',
                    boxShadow: hasHorizontalOverflow || isCarouselActive
                      ? 'inset 0 0 0 1px color-mix(in srgb, var(--tt-border) 68%, transparent)'
                      : undefined,
                  }}
                  onMouseEnter={() => setIsCarouselActive(true)}
                  onMouseLeave={() => setIsCarouselActive(false)}
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

                  <div
                    ref={tabsViewportRef}
                    className="flex items-stretch overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="tablist"
                    aria-label="Workspaces"
                    onWheel={handleViewportWheel}
                    onFocus={() => setIsCarouselActive(true)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsCarouselActive(false);
                      }
                    }}
                    onKeyDown={handleViewportKeyDown}
                  >
                    {tabs.map((ws) => {
                      const selected = state.workspace === ws.id;
                      const showRemoveControl = ws.id !== ALL_WORKSPACE_TAB.id;
                      return (
                          <div key={ws.id} className="relative flex items-stretch">
                            <button
                                type="button"
                                role="tab"
                                data-workspace-id={ws.id}
                                aria-selected={selected}
                                onClick={() => setWorkspace(ws.id)}
                                className={`flex h-10 items-center border-b-2 px-4 text-sm font-medium transition-colors ${
                                    selected
                                         ? ''
                                         : 'border-transparent'
                                }`}
                                 style={selected
                                   ? { borderColor: 'var(--tt-accent)', color: 'var(--tt-accent)' }
                                   : { color: 'var(--tt-text-muted)' }}
                            >
                              <span className="whitespace-nowrap">{ws.label}</span>
                            </button>

                            <span
                              className="mr-1 flex h-10 w-6 shrink-0 items-center justify-center border-b-2 border-transparent"
                              aria-hidden={showRemoveControl ? undefined : 'true'}
                            >
                            {showRemoveControl ? (
                                <button
                                    type="button"
                                    aria-label={`Remove workspace ${ws.label}`}
                                    title={canRemoveWorkspace ? `Remove ${ws.label}` : 'At least one workspace must remain'}
                                    onClick={() => handleRemove(ws.id)}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-[var(--tt-surface-hover)] focus:outline-none disabled:hover:bg-transparent"
                                    disabled={!canRemoveWorkspace}
                                    aria-disabled={!canRemoveWorkspace}
                                    style={{
                                      lineHeight: 0,
                                      color: 'var(--tt-text-soft)',
                                      background: canRemoveWorkspace ? 'transparent' : 'color-mix(in srgb, var(--tt-surface-subtle) 72%, transparent)',
                                      opacity: canRemoveWorkspace ? 1 : 0.45,
                                      cursor: canRemoveWorkspace ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                            ) : null}
                            </span>
                          </div>
                      );
                    })}

                    {userWorkspaces.length === 0 && !isAdding && (
                        <div className="ml-3 flex h-10 items-center text-xs italic" style={{ color: 'var(--tt-text-soft)' }}>
                          Click + to add workspace
                        </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative z-[70] flex shrink-0 items-stretch gap-2">
                <Dropdown
                  align="right"
                  menuWidth="trigger"
                  className="shrink-0"
                  isOpen={selectorOpen}
                  onOpen={() => setSelectorOpen(true)}
                  onClose={() => setSelectorOpen(false)}
                  trigger={
                    <span
                      className="inline-flex h-10 items-center justify-between gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                      style={{
                        width: WORKSPACE_SELECTOR_WIDTH,
                        borderColor: 'var(--tt-border)',
                        background: selectorOpen ? 'var(--tt-surface-elevated)' : 'var(--tt-surface)',
                        color: 'var(--tt-text)',
                        boxShadow: selectorOpen ? 'var(--tt-shadow-soft)' : undefined,
                      }}
                    >
                      <span className="truncate text-left">{activeWorkspaceLabel}</span>
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  }
                >
                  {tabs.map((workspace) => {
                    const selected = workspace.id === state.workspace;
                    return (
                      <DropdownItem key={workspace.id} onClick={() => handleWorkspaceSelectFromDropdown(workspace.id)}>
                        <span className="flex items-center justify-between gap-3">
                          <span>{workspace.label}</span>
                          {selected ? (
                            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" style={{ color: 'var(--tt-accent)' }}>
                              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                      </DropdownItem>
                    );
                  })}
                </Dropdown>

                {!isAdding ? (
                  <div className={`flex h-10 shrink-0 items-center justify-center rounded-xl border border-transparent ${addWorkspaceSlotClassName}`}>
                    <button
                        type="button"
                        aria-label="Add workspace"
                        title="New workspace"
                        onClick={handleToggleAdd}
                        className={`${addWorkspaceButtonClassName} hover:bg-[var(--tt-surface-hover)]`}
                        style={addWorkspaceButtonStyle}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex h-10 w-[15rem] shrink-0 items-center border-b-2 px-1 sm:w-[16rem]" style={{ borderColor: 'var(--tt-accent)' }}>
                    <div
                      className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-xl border px-1.5 focus-within:ring-2 focus-within:ring-[var(--tt-ring)]"
                      style={{
                        borderColor: 'color-mix(in srgb, var(--tt-accent) 18%, var(--tt-border))',
                        background: 'var(--tt-surface)',
                      }}
                    >
                      <input
                          type="text"
                          value={newWorkspaceName}
                          onChange={(e) => setNewWorkspaceName(e.target.value)}
                          onKeyDown={handleKeyDown}
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
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                          type="button"
                          aria-label="Cancel add workspace"
                          title="Cancel"
                          onClick={handleCancelAdd}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--tt-surface-hover)] focus-visible:outline-none"
                          style={{ color: 'var(--tt-text-soft)' }}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
            )}
          </div>
        </AppContentContainer>
      </div>
  );
}