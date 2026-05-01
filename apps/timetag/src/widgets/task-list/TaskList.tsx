'use client';

import React, { useEffect, useState } from 'react';
import { TaskRow } from '@/entities';
import { useTasks } from '@/store';
import { ClipboardIcon } from '@/shared/icons';

const ITEMS_PER_PAGE = 10;

interface TaskListProps {
  onDeleteTask: (id: string) => void;
}

export function TaskList({ onDeleteTask }: TaskListProps) {
  const {
    visibleTasks,
    toggleTimer,
    resetTimer,
    toggleTaskStatus,
    archiveTask,
    restoreTask,
    toggleSelect,
    state,
  } = useTasks();
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    setVisibleCount((prev) => Math.max(ITEMS_PER_PAGE, Math.min(prev, visibleTasks.length || ITEMS_PER_PAGE)));
  }, [visibleTasks.length]);

  const hasMore = visibleCount < visibleTasks.length;
  const visibleRows = visibleTasks.slice(0, visibleCount);

  if (visibleTasks.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center px-4 py-12"
        style={{ background: 'var(--tt-surface)' }}
      >
        <ClipboardIcon size="lg" color="text-gray-300" className="mb-4" />
        <p className="text-center" style={{ color: 'var(--tt-text-muted)' }}>
          No tasks found.
          <br />
          <span className="text-sm" style={{ color: 'var(--tt-text-soft)' }}>Add a new task to get started!</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--tt-surface)' }}>
      <div
        className="divide-y divide-[var(--tt-border)]"
        style={{ background: 'var(--tt-surface)' }}
      >
        {visibleRows.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isSelected={state.selectedIds.has(task.id)}
            onToggleSelect={toggleSelect}
            onToggleStatus={toggleTaskStatus}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onArchive={archiveTask}
            onRestore={restoreTask}
            onDelete={onDeleteTask}
          />
        ))}
      </div>

      {/* Pagination Control */}
      {hasMore && (
        <div
          className="flex justify-center border-t px-4 py-4"
          style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface-muted)' }}
        >
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
            className="rounded-xl border bg-[var(--tt-surface)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--tt-surface-hover)]"
            style={{
              color: 'var(--tt-accent)',
              borderColor: 'var(--tt-border)',
              boxShadow: 'var(--tt-shadow-soft)',
            }}
          >
            Show more ({visibleTasks.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

