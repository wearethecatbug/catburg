'use client';

import { useMemo } from 'react';
import {
  DEFAULT_USER_WORKSPACES,
  normalizeWorkspaceTabs,
  type WorkspaceTab,
  WORKSPACES_STORAGE_KEY,
} from '@/domain/workspace';
import { useLocalStorage } from './useLocalStorage';

export function usePersistedWorkspaces() {
  const [storedWorkspaces, setStoredWorkspaces, isHydrated] = useLocalStorage<WorkspaceTab[]>(
    WORKSPACES_STORAGE_KEY,
    DEFAULT_USER_WORKSPACES,
  );

  const workspaces = useMemo(() => normalizeWorkspaceTabs(storedWorkspaces), [storedWorkspaces]);

  return {
    workspaces,
    setWorkspaces: setStoredWorkspaces,
    isHydrated,
  };
}

