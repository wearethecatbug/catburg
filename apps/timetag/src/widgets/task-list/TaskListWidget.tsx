'use client';

import React, { useRef, useCallback } from 'react';
import { Header } from '@/widgets/header';
import {
  WorkspaceSwitch,
  StatusFilters,
  SearchInput,
  SortDropdown,
  FilterDropdown,
  BulkDropdown,
  AddTaskInput,
} from '@/features';
import { TaskList } from '@/widgets';
import { useToast, Chip } from '@/shared/ui';
import { useKeyboardShortcuts } from '@/shared/hooks';
import { useTasks } from '@/store';

/**
 * TaskListWidget — Screen assembler.
 * Composes all vertical layers: Header → Workspace → Status → Controls → Composer → List → Pagination
 */
export function TaskListWidget() {
  const { deleteTask, deleteSelected, undoDelete, hasSelection, state, setFilter, setSearch } = useTasks();
  const { showToast, ToastContainer } = useToast();

  const addInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onAddFocus: () => addInputRef.current?.focus(),
    onSearchFocus: () => searchInputRef.current?.focus(),
    onSearchClear: () => {
      setSearch('');
    },
  });

  // Delete with undo toast
  const handleDeleteTask = useCallback(
    (id: string) => {
      deleteTask(id);
      showToast('Task deleted', { label: 'Undo', onClick: undoDelete });
    },
    [deleteTask, showToast, undoDelete],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!hasSelection) return;
    deleteSelected();
    showToast('Tasks deleted', { label: 'Undo', onClick: undoDelete });
  }, [deleteSelected, hasSelection, showToast, undoDelete]);

  const disableApproachingRed = () => {
    setFilter({
      approachingRed: { ...state.filter.approachingRed, enabled: false },
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />
      <WorkspaceSwitch />
      <StatusFilters />

      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* List Controls + Composer area */}
        <div className="p-4 space-y-3 bg-white border-b border-gray-200">
          {/* Add Task Input (Composer) */}
          <AddTaskInput ref={addInputRef} />

          {/* Search + Tools Row */}
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <SearchInput ref={searchInputRef} />
            </div>
            <div className="flex items-center gap-2">
              <SortDropdown />
              <FilterDropdown />
              <BulkDropdown onDeleteSelected={handleDeleteSelected} />

              {/* AR Chip */}
              {state.filter.approachingRed.enabled && (
                <Chip onRemove={disableApproachingRed}>
                  AR {state.filter.approachingRed.windowMinutes}m
                </Chip>
              )}
            </div>
          </div>
        </div>

        {/* Task List */}
        <TaskList onDeleteTask={handleDeleteTask} />
      </main>

      <ToastContainer />
    </div>
  );
}

