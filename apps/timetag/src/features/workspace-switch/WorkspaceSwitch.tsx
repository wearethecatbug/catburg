'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { AssignableWorkspaceType } from '@/domain/task.types';
import {
  ALL_WORKSPACE_TAB,
  createWorkspaceId,
  getSafeDefaultWorkspace,
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

  // Track if component is mounted (client-side) to prevent flash
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // State for inline add input
  const [isAdding, setIsAdding] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');


  // Combined tabs for rendering: user tabs (order preserved) + All tab
  const tabs = [ALL_WORKSPACE_TAB, ...userWorkspaces];

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
        const next = userWorkspaces.filter((w) => w.id !== id);
        setUserWorkspaces(next);
        // if removed one was active, fallback to 'all'
        if (state.workspace === id) {
          setWorkspace('all');
        }

        if (settings.general.defaultWorkspace === id) {
          updateGeneral({ defaultWorkspace: getSafeDefaultWorkspace(next, undefined) });
        }
      },
      [settings.general.defaultWorkspace, setUserWorkspaces, setWorkspace, state.workspace, updateGeneral, userWorkspaces],
  );

  return (
      <div className="flex items-center border-b border-gray-200 px-2" role="tablist" aria-label="Workspaces">
        {!isMounted ? (
            // Skeleton loader during SSR/initial mount to prevent flash
            <>
              <div className="px-4 py-2 h-10 w-16 bg-gray-100 animate-pulse rounded" />
              <div className="ml-2 px-4 py-2 h-10 w-16 bg-gray-100 animate-pulse rounded" />
            </>
        ) : (
            <>
              {tabs.map((ws) => {
                const selected = state.workspace === ws.id;
                return (
                    <div key={ws.id} className="relative flex items-center">
                      <button
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setWorkspace(ws.id)}
                          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                              selected
                                  ? 'border-blue-600 text-blue-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                      >
                        <span className="whitespace-nowrap">{ws.label}</span>
                      </button>

                      {/* render remove control for user-owned tabs (not All) */}
                      {ws.id !== ALL_WORKSPACE_TAB.id && (
                          <button
                              type="button"
                              aria-label={`Remove workspace ${ws.label}`}
                              title={`Remove ${ws.label}`}
                              onClick={() => handleRemove(ws.id)}
                              className="ml-0 mr-1 text-gray-400 hover:text-red-500 focus:outline-none"
                              style={{ lineHeight: 0 }}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                      )}
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
                        className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
              ) : (
                  <div className="ml-2 flex items-center gap-2 border-b-2 border-blue-600 pb-2">
                    <input
                        type="text"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Workspace name"
                        autoFocus
                        className="px-2 py-1 text-sm text-gray-600 border-none outline-none bg-transparent"
                        style={{ minWidth: '120px' }}
                    />
                    <button
                        type="button"
                        aria-label="Confirm add workspace"
                        title="Add"
                        onClick={handleConfirmAdd}
                        className="text-blue-600 hover:text-blue-800"
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
                        className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
              )}

              {/* Placeholder hint when no user workspaces and not adding */}
              {userWorkspaces.length === 0 && !isAdding && (
                  <div className="ml-3 text-xs text-gray-400 italic">
                    Click + to add workspace
                  </div>
              )}
            </>
        )}
      </div>
  );
}