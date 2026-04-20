'use client';

import React from 'react';
import { getSafeDefaultWorkspace, getWorkspaceLabel } from '@/domain/workspace';
import type { AppSettings, GeneralSettings, GeneralTabId } from '@/domain/settings.types';
import type { AssignableWorkspaceType } from '@/domain/task.types';
import { usePersistedWorkspaces } from '@/shared';

interface GeneralSettingsSectionProps {
  activeTab: GeneralTabId;
  settings: AppSettings;
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
      <span className="space-y-1">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="block text-xs text-gray-500">{description}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </label>
  );
}

export function GeneralSettingsSection({ activeTab, settings, updateGeneral }: GeneralSettingsSectionProps) {
  const { workspaces, isHydrated: areWorkspacesHydrated } = usePersistedWorkspaces();
  const hasWorkspaceTabs = workspaces.length > 0;
  const fallbackWorkspaceLabel = getWorkspaceLabel(workspaces, settings.general.defaultWorkspace);

  React.useEffect(() => {
    if (!areWorkspacesHydrated) return;
    if (workspaces.length === 0) return;

    const safeWorkspace = getSafeDefaultWorkspace(workspaces, settings.general.defaultWorkspace);
    if (safeWorkspace !== settings.general.defaultWorkspace) {
      updateGeneral({ defaultWorkspace: safeWorkspace });
    }
  }, [areWorkspacesHydrated, settings.general.defaultWorkspace, updateGeneral, workspaces]);

  if (activeTab === 'behavior') {
    return (
      <div className="space-y-3">
        <Field
          label="Auto-start timer when task created"
          description="Enable the task timer by default when a new task is added from the composer."
        >
          <input
            type="checkbox"
            checked={settings.general.autoStartTimerWhenTaskCreated}
            onChange={(e) => updateGeneral({ autoStartTimerWhenTaskCreated: e.target.checked })}
            aria-label="Auto-start timer when task created"
          />
        </Field>

        <Field
          label="Auto-pause other timers"
          description="When a timer starts, pause the rest even if multiple timers are otherwise allowed."
        >
          <input
            type="checkbox"
            checked={settings.general.autoPauseOtherTimers}
            onChange={(e) => updateGeneral({ autoPauseOtherTimers: e.target.checked })}
            aria-label="Auto-pause other timers"
          />
        </Field>

        <Field
          label="Confirm before delete"
          description="Ask for confirmation before deleting a task or bulk selection."
        >
          <input
            type="checkbox"
            checked={settings.general.confirmBeforeDelete}
            onChange={(e) => updateGeneral({ confirmBeforeDelete: e.target.checked })}
            aria-label="Confirm before delete"
          />
        </Field>
      </div>
    );
  }

  if (activeTab === 'defaults') {
    return (
      <div className="space-y-3">

        <Field
          label="Default workspace"
          description={hasWorkspaceTabs
            ? 'Used when creating a task from All workspaces.'
            : `No removable workspace tabs are available right now. New tasks from All will fall back to ${fallbackWorkspaceLabel} until a workspace tab is created.`}
        >
          {hasWorkspaceTabs ? (
            <select
              value={settings.general.defaultWorkspace}
              onChange={(e) => updateGeneral({ defaultWorkspace: e.target.value as AssignableWorkspaceType })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
              aria-label="Default workspace"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="inline-flex items-center rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500"
              aria-label="Default workspace empty state"
            >
              No workspace tabs available
            </span>
          )}
        </Field>

        <Field label="Default task view" description="Used as the initial status view when the app opens.">
          <select
            value={settings.general.defaultTaskView}
            onChange={(e) => updateGeneral({ defaultTaskView: e.target.value as typeof settings.general.defaultTaskView })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Default task view"
          >
            <option value="active">Active</option>
            <option value="all">All</option>
          </select>
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Show completed tasks"
        description="Keep done and archived items visible in the All view and in status tabs."
      >
        <input
          type="checkbox"
          checked={settings.general.showCompletedTasks}
          onChange={(e) => updateGeneral({ showCompletedTasks: e.target.checked })}
          aria-label="Show completed tasks"
        />
      </Field>

      <Field
        label="Show urgency indicator"
        description="Keep urgency-based cues visible in the task list."
      >
        <input
          type="checkbox"
          checked={settings.general.showUrgencyIndicator}
          onChange={(e) => updateGeneral({ showUrgencyIndicator: e.target.checked })}
          aria-label="Show urgency indicator"
        />
      </Field>
    </div>
  );
}


