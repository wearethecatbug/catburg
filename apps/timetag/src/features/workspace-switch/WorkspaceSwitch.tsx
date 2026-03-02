'use client';

import React from 'react';
import type { WorkspaceType } from '@/domain/task.types';
import { useTasks } from '@/store';

const WORKSPACES: { id: WorkspaceType; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'home', label: 'Home' },
  { id: 'all', label: '+All' },
];

export function WorkspaceSwitch() {
  const { state, setWorkspace } = useTasks();

  return (
    <div className="flex border-b border-gray-200" role="tablist">
      {WORKSPACES.map((ws) => (
        <button
          key={ws.id}
          type="button"
          role="tab"
          aria-selected={state.workspace === ws.id}
          onClick={() => setWorkspace(ws.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            state.workspace === ws.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {ws.label}
        </button>
      ))}
    </div>
  );
}

