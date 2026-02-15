'use client';

import React, { useState, forwardRef } from 'react';
import { useTasks } from '@/context';
import { WorkspaceType } from '@/types';
import { PlusIcon } from '@/components';

interface AddTaskInputProps {
  defaultWorkspace?: WorkspaceType;
}

export const AddTaskInput = forwardRef<HTMLInputElement, AddTaskInputProps>(
  function AddTaskInput({ defaultWorkspace }, ref) {
    const [value, setValue] = useState('');
    const { addTask, state } = useTasks();

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const title = value.trim();
      if (!title) return;

      addTask({
        title,
        workspace: defaultWorkspace ?? (state.workspace === 'all' ? 'work' : state.workspace),
      });
      setValue('');
    };

    return (
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a new task..."
          className="w-full pl-4 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Add a new task"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          aria-label="Add task"
        >
          <PlusIcon size="md" />
        </button>
      </form>
    );
  }
);
