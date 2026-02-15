'use client';

import React, { useRef, useCallback } from 'react';
import { Header } from '@/features/header';
import { WorkspaceTabs } from '@/features/workspace-tabs';
import { StatusFilters } from '@/features/filters';
import { Composer } from '@/features/composer';
import { TaskList } from '@/features/task-list';
import { useToast } from '@/components';
import { useTasks } from '@/context';
import { useKeyboardShortcuts } from '@/hooks';

export default function HomePage() {
  const { deleteTask, deleteSelected, undoDelete, hasSelection } = useTasks();
  const { showToast, ToastContainer } = useToast();

  const addInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onAddFocus: () => addInputRef.current?.focus(),
    onSearchFocus: () => searchInputRef.current?.focus(),
    onSearchClear: () => {
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
    },
  });

  // Delete task with undo toast
  const handleDeleteTask = useCallback(
    (id: string) => {
      deleteTask(id);
      showToast('Task deleted', {
        label: 'Undo',
        onClick: undoDelete,
      });
    },
    [deleteTask, showToast, undoDelete]
  );

  // Delete selected with undo toast
  const handleDeleteSelected = useCallback(() => {
    if (!hasSelection) return;
    deleteSelected();
    showToast('Tasks deleted', {
      label: 'Undo',
      onClick: undoDelete,
    });
  }, [deleteSelected, hasSelection, showToast, undoDelete]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />
      <WorkspaceTabs />
      <StatusFilters />

      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <Composer
          onDeleteSelected={handleDeleteSelected}
          addInputRef={addInputRef}
          searchInputRef={searchInputRef}
        />
        <TaskList onDeleteTask={handleDeleteTask} />
      </main>

      <ToastContainer />
    </div>
  );
}


