'use client';

import React, { useRef, useCallback, useState } from 'react';
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
import { AppContentContainer, useToast, Chip } from '@/shared/ui';
import { useKeyboardShortcuts } from '@/shared/hooks';
import { useSettings, useTasks } from '@/store';

/**
 * TaskListWidget — Screen assembler.
 * Composes all vertical layers: Header → Workspace → Status → Controls → Composer → List → Pagination
 */
export function TaskListWidget() {
  const { deleteTask, deleteSelected, undoDelete, hasSelection, state, setFilter, setSearch } = useTasks();
  const { settings } = useSettings();
  const { showToast, ToastContainer } = useToast();

  const addInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const disableApproachingRed = () => {
    setFilter({
      approachingRed: { ...state.filter.approachingRed, enabled: false },
    });
  };

  const approachingRedChip = state.filter.approachingRed.enabled ? (
    <Chip tone="info" onRemove={disableApproachingRed}>
      AR {state.filter.approachingRed.windowMinutes}m
    </Chip>
  ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      <WorkspaceSwitch />
      <StatusFilters />

      <main
        className="flex min-h-0 flex-1 flex-col overflow-hidden border-t"
        style={{
          background: 'var(--tt-surface-elevated)',
          borderColor: 'var(--tt-border)',
        }}
      >
        <AppContentContainer className="flex h-full min-h-0 flex-col">
          <div
            className="space-y-3 border-b py-4"
            style={{
              background: 'var(--tt-surface)',
              borderColor: 'var(--tt-border)',
            }}
          >
            <AddTaskInput ref={addInputRef} />

            <div className="space-y-3 lg:flex lg:items-center lg:gap-3 lg:space-y-0">
              <div className="min-w-0 flex-1">
                <SearchInput ref={searchInputRef} />
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <div className="order-2 lg:order-1">
                  <SortDropdown />
                </div>
                <div className="order-1 lg:order-2">
                  <FilterDropdown />
                </div>
                <div className="order-3">
                  <BulkDropdown onDeleteSelected={handleDeleteSelected} />
                </div>
                {approachingRedChip && <div className="order-4">{approachingRedChip}</div>}
              </div>
            </div>
          </div>

          <TaskList onDeleteTask={handleDeleteTask} />
        </AppContentContainer>
      </main>

      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ToastContainer />
    </div>
  );
}

