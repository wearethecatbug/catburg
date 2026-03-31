'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Header } from '@/widgets/header';
import { SettingsPanel } from '@/widgets/settings-panel';
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
import { useSettings, useTasks } from '@/store';

/**
 * TaskListWidget — Screen assembler.
 * Composes all vertical layers: Header → Workspace → Status → Controls → Composer → List → Pagination
 */
export function TaskListWidget() {
  const { deleteTask, deleteSelected, undoDelete, hasSelection, state, setFilter, setSearch } = useTasks();
  const { settings, isHydrated: areSettingsHydrated } = useSettings();
  const { showToast, ToastContainer } = useToast();

  const addInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasAppliedStartupViewRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
      if (settings.general.confirmBeforeDelete && !window.confirm('Delete this task?')) {
        return;
      }

      deleteTask(id);
      showToast('Task deleted', { label: 'Undo', onClick: undoDelete });
    },
    [deleteTask, settings.general.confirmBeforeDelete, showToast, undoDelete],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!hasSelection) return;

    if (settings.general.confirmBeforeDelete && !window.confirm('Delete selected tasks?')) {
      return;
    }

    deleteSelected();
    showToast('Tasks deleted', { label: 'Undo', onClick: undoDelete });
  }, [deleteSelected, hasSelection, settings.general.confirmBeforeDelete, showToast, undoDelete]);

  useEffect(() => {
    if (!areSettingsHydrated || hasAppliedStartupViewRef.current) return;

    setFilter({ status: settings.general.defaultTaskView });
    hasAppliedStartupViewRef.current = true;
  }, [areSettingsHydrated, setFilter, settings.general.defaultTaskView]);

  useEffect(() => {
    if (settings.general.showCompletedTasks) return;
    if (state.filter.status === 'done' || state.filter.status === 'archived') {
      setFilter({ status: 'active' });
    }
  }, [setFilter, settings.general.showCompletedTasks, state.filter.status]);

  const disableApproachingRed = () => {
    setFilter({
      approachingRed: { ...state.filter.approachingRed, enabled: false },
    });
  };

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--tt-app-bg)' }}>
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      <WorkspaceSwitch />
      <StatusFilters />

      <main
        className="flex-1 flex flex-col overflow-hidden border-t"
        style={{
          background: 'var(--tt-surface-elevated)',
            borderColor: 'var(--tt-border)',
        }}
      >
        {/* List Controls + Composer area */}
        <div
          className="space-y-3 border-b p-4"
          style={{
            background: 'var(--tt-surface)',
            borderColor: 'var(--tt-border)',
          }}
        >
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
                <Chip tone="info" onRemove={disableApproachingRed}>
                  AR {state.filter.approachingRed.windowMinutes}m
                </Chip>
              )}
            </div>
          </div>
        </div>

        {/* Task List */}
        <TaskList onDeleteTask={handleDeleteTask} />
      </main>

      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ToastContainer />
    </div>
  );
}

