'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { AssignableWorkspaceType } from '@/domain/task.types';
import {
  ALL_WORKSPACE_TAB,
  createWorkspaceId,
  type WorkspaceTab,
} from '@/domain/workspace';
import { useSettings, useTasks } from '@/store';
import { usePersistedWorkspaces } from '@/shared';

/**
 * WorkspaceSwitch — renders user-manageable workspace tabs + All + add-button.
 * Workspaces list persisted to localStorage so user changes survive reloads.
 */
export function WorkspaceSwitch() {
  const { state, setWorkspace } = useTasks();
  const { settings, updateGeneral } = useSettings();
  const { workspaces: userWorkspaces, setWorkspaces: setUserWorkspaces } = usePersistedWorkspaces();

  // Keep the initial client render aligned with SSR output to avoid a tab flash.
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // State for inline add input
  const [isAdding, setIsAdding] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');


  // Combined tabs for rendering: All tab first, then user tabs (order preserved)
  const tabs = [ALL_WORKSPACE_TAB, ...userWorkspaces];
  const canRemoveWorkspace = userWorkspaces.length > 1;

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
        className="flex items-stretch border-b px-2"
        role="tablist"
        aria-label="Workspaces"
        style={{
          borderColor: 'var(--tt-border)',
          background: 'var(--tt-surface-muted)',
          backdropFilter: 'blur(16px) saturate(1.06)',
        }}
      >
        {!isMounted ? (
            // Skeleton loader during SSR/initial mount to prevent flash
            <>
              <div className="h-10 w-16 animate-pulse rounded px-4 py-2" style={{ background: 'var(--tt-surface-subtle)' }} />
              <div className="ml-2 h-10 w-16 animate-pulse rounded px-4 py-2" style={{ background: 'var(--tt-surface-subtle)' }} />
            </>
        ) : (
            <>
              {tabs.map((ws) => {
                const selected = state.workspace === ws.id;
                const showRemoveControl = ws.id !== ALL_WORKSPACE_TAB.id;
                return (
                    <div key={ws.id} className="relative flex items-stretch">
                      <button
                          type="button"
                          role="tab"
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
                      {/* render remove control for user-owned tabs (not All) */}
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

              {/* Add button or inline input */}
              {!isAdding ? (
                  <div className="ml-2">
                    <button
                        type="button"
                        aria-label="Add workspace"
                        title="Add workspace"
                        onClick={handleToggleAdd}
                        className="rounded px-2 py-1 text-sm"
                        style={{ color: 'var(--tt-text-muted)' }}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
              ) : (
                  <div className="ml-2 flex items-center gap-2 border-b-2 pb-2" style={{ borderColor: 'var(--tt-accent)' }}>
                    <input
                        type="text"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Workspace name"
                        autoFocus
                        className="border-none bg-transparent px-2 py-1 text-sm outline-none"
                        style={{ minWidth: '120px', color: 'var(--tt-text)' }}
                    />
                    <button
                        type="button"
                        aria-label="Confirm add workspace"
                        title="Add"
                        onClick={handleConfirmAdd}
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
                        style={{ color: 'var(--tt-text-soft)' }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
              )}

              {/* Placeholder hint when no user workspaces and not adding */}
              {userWorkspaces.length === 0 && !isAdding && (
                  <div className="ml-3 text-xs italic" style={{ color: 'var(--tt-text-soft)' }}>
                    Click + to add workspace
                  </div>
              )}
            </>
        )}
      </div>
  );
}