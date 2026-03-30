import type { AssignableWorkspaceType, WorkspaceType } from './task.types';
import { generateId } from './helpers';

export interface WorkspaceTab {
  id: AssignableWorkspaceType;
  label: string;
}

export const WORKSPACES_STORAGE_KEY = 'timetag-workspaces';

export const DEFAULT_USER_WORKSPACES: WorkspaceTab[] = [
  { id: 'work', label: 'Work' },
  { id: 'home', label: 'Home' },
];

export const ALL_WORKSPACE_TAB: { id: WorkspaceType; label: string } = {
  id: 'all',
  label: 'All',
};

export function isAssignableWorkspaceType(value: unknown): value is AssignableWorkspaceType {
  return typeof value === 'string' && value.trim().length > 0 && value !== 'all';
}

export function slugifyWorkspaceLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}

export function createWorkspaceId(label: string): AssignableWorkspaceType {
  const slug = slugifyWorkspaceLabel(label);
  if (slug) return slug as AssignableWorkspaceType;

  return `ws-${generateId()}` as AssignableWorkspaceType;
}

export function normalizeWorkspaceTabs(raw: unknown): WorkspaceTab[] {
  if (!Array.isArray(raw)) return DEFAULT_USER_WORKSPACES;
  if (raw.length === 0) return [];

  const seen = new Set<string>();
  const normalized = raw.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];

    const candidate = item as { id?: unknown; label?: unknown };
    if (!isAssignableWorkspaceType(candidate.id)) return [];

    const label = typeof candidate.label === 'string' && candidate.label.trim()
      ? candidate.label.trim()
      : candidate.id;

    if (seen.has(candidate.id)) return [];
    seen.add(candidate.id);

    return [{ id: candidate.id, label } satisfies WorkspaceTab];
  });

  return normalized.length > 0 ? normalized : DEFAULT_USER_WORKSPACES;
}

export function hasWorkspace(workspaces: WorkspaceTab[], workspaceId: unknown): workspaceId is AssignableWorkspaceType {
  return isAssignableWorkspaceType(workspaceId) && workspaces.some((workspace) => workspace.id === workspaceId);
}

export function getSafeDefaultWorkspace(
  workspaces: WorkspaceTab[],
  workspaceId: unknown,
  fallback: AssignableWorkspaceType = DEFAULT_USER_WORKSPACES[0].id,
): AssignableWorkspaceType {
  return hasWorkspace(workspaces, workspaceId) ? workspaceId : fallback;
}


