'use client';

import React from 'react';
import type { GeneralTabId } from '@/domain/settings.types';
import type { DefaultWorkspaceType } from '@/domain/task.types';
import { useSettings } from '@/store';

interface GeneralSettingsSectionProps {
  activeTab: GeneralTabId;
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

export function GeneralSettingsSection({ activeTab }: GeneralSettingsSectionProps) {
  const { settings, updateGeneral } = useSettings();

  if (activeTab === 'behavior') {
    return (
      <div className="space-y-3">
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
        <Field label="Default workspace" description="Used when creating a task from All workspaces.">
          <select
            value={settings.general.defaultWorkspace}
            onChange={(e) => updateGeneral({ defaultWorkspace: e.target.value as DefaultWorkspaceType })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Default workspace"
          >
            <option value="work">Work</option>
            <option value="home">Home</option>
          </select>
        </Field>

        <Field label="Default task view" description="Used as the initial status view when the app opens.">
          <select
            value={settings.general.defaultTaskViewOnStartup}
            onChange={(e) => updateGeneral({ defaultTaskViewOnStartup: e.target.value as typeof settings.general.defaultTaskViewOnStartup })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Default task view"
          >
            <option value="active">Active</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

      <Field
        label="Show note previews in task list"
        description="Display the first note line directly under the task title."
      >
        <input
          type="checkbox"
          checked={settings.general.showNotePreviewsInTaskList}
          onChange={(e) => updateGeneral({ showNotePreviewsInTaskList: e.target.checked })}
          aria-label="Show note previews in task list"
        />
      </Field>
    </div>
  );
}


