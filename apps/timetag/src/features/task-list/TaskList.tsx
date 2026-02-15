'use client';

import React, { useState } from 'react';
import { TaskRow } from './TaskRow';
import { useTasks } from '@/context';
import { ClipboardIcon } from '@/components';

const ITEMS_PER_PAGE = 10;

interface TaskListProps {
  onDeleteTask: (id: string) => void;
}

export function TaskList({ onDeleteTask }: TaskListProps) {
  const { filteredTasks } = useTasks();
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const hasMore = visibleCount < filteredTasks.length;
  const visibleTasks = filteredTasks.slice(0, visibleCount);

  const handleShowMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <ClipboardIcon size="lg" color="text-gray-300" className="mb-4" />
        <p className="text-gray-500 text-center">
          No tasks found.
          <br />
          <span className="text-sm text-gray-400">
            Add a new task to get started!
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="divide-y divide-gray-100">
        {visibleTasks.map((task) => (
          <TaskRow key={task.id} task={task} onDelete={onDeleteTask} />
        ))}
      </div>

      {/* Pagination Control */}
      {hasMore && (
        <div className="flex justify-center py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleShowMore}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
          >
            Show more ({filteredTasks.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
