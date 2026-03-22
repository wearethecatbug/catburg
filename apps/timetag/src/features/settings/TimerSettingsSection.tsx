'use client';

import React from 'react';
import type { TimerTabId } from '@/domain/settings.types';
import { useSettings } from '@/store';

interface TimerSettingsSectionProps {
  activeTab: TimerTabId;
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

export function TimerSettingsSection({ activeTab }: TimerSettingsSectionProps) {
  const { settings, updateTimer } = useSettings();

  if (activeTab === 'mode') {
    return (
      <div className="space-y-3">
        <Field label="Default mode" description="Preselect this mode in the task composer.">
          <select
            value={settings.timer.defaultMode}
            onChange={(e) => updateTimer({ defaultMode: e.target.value as typeof settings.timer.defaultMode })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            aria-label="Default mode"
          >
            <option value="duration">Duration</option>
            <option value="pomodoro">Pomodoro</option>
            <option value="deadline">Deadline</option>
          </select>
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Allow multiple timers" description="Permit more than one task timer to run at the same time.">
        <input
          type="checkbox"
          checked={settings.timer.allowMultipleTimers}
          onChange={(e) => updateTimer({ allowMultipleTimers: e.target.checked })}
          aria-label="Allow multiple timers"
        />
      </Field>

      <Field label="Overtime behavior" description="Choose whether timers continue into overtime or stop at zero.">
        <select
          value={settings.timer.overtimeBehavior}
          onChange={(e) => updateTimer({ overtimeBehavior: e.target.value as typeof settings.timer.overtimeBehavior })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          aria-label="Overtime behavior"
        >
          <option value="continue">Continue counting</option>
          <option value="stop">Stop at zero</option>
        </select>
      </Field>

      <Field label="Show seconds in timer" description="Reserved for timer display formatting in a follow-up iteration.">
        <input
          type="checkbox"
          checked={settings.timer.showSecondsInTimer}
          onChange={(e) => updateTimer({ showSecondsInTimer: e.target.checked })}
          aria-label="Show seconds in timer"
        />
      </Field>
    </div>
  );
}

