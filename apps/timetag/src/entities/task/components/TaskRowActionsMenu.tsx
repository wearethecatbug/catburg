import { Dropdown, DropdownDivider, DropdownItem, MoreVerticalIcon } from '@/shared';
import type { TaskStatus } from '@/domain/task.types';

interface TaskRowActionsMenuProps {
  status: TaskStatus;
  showResetTimer: boolean;
  onResetTimer: () => void;
  onToggleStatus: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

export function TaskRowActionsMenu({
  status,
  showResetTimer,
  onResetTimer,
  onToggleStatus,
  onArchive,
  onRestore,
  onDelete,
}: TaskRowActionsMenuProps) {
  return (
    <div className="ml-3 shrink-0">
      <Dropdown
        trigger={
          <span
            className="rounded-lg p-1.5 transition-colors group-hover:bg-[var(--tt-row-hover)]"
            style={{ color: 'var(--tt-text-soft)' }}
          >
            <MoreVerticalIcon size="sm" aria-label="Task options" />
          </span>
        }
        align="right"
      >
        {showResetTimer && <DropdownItem onClick={onResetTimer}>Reset timer</DropdownItem>}
        <DropdownItem onClick={onToggleStatus}>
          {status === 'done' ? 'Reopen' : 'Mark as done'}
        </DropdownItem>
        {status !== 'archived' ? (
          <DropdownItem onClick={onArchive}>Archive</DropdownItem>
        ) : (
          <DropdownItem onClick={onRestore}>Restore</DropdownItem>
        )}
        <DropdownDivider />
        <DropdownItem onClick={onDelete} danger>
          Delete
        </DropdownItem>
      </Dropdown>
    </div>
  );
}

