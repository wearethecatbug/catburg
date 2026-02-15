'use client';

import React from 'react';
import { WorkspaceType } from '@/types';
import { useTasks } from '@/context';

const WORKSPACES: { id: WorkspaceType; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'home', label: 'Home' },
  { id: 'all', label: '+All' },
];

export function WorkspaceTabs() {
  const { state, setWorkspace } = useTasks();

  return (
    <div className="flex border-b border-gray-200" role="tablist">
      {WORKSPACES.map((workspace) => (
        <button
          key={workspace.id}
          type="button"
          role="tab"
          aria-selected={state.workspace === workspace.id}
          onClick={() => setWorkspace(workspace.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            state.workspace === workspace.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {workspace.label}
        </button>
      ))}
    </div>
  );
}

