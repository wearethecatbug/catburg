import type { Page } from '@playwright/test';
import { SETTINGS_STORAGE_KEY, TASKS_STORAGE_KEY, testSettings, type StoredTask } from '../fixtures/timetag-state';

const WORKSPACES_STORAGE_KEY = 'timetag-workspaces';

export interface StoredWorkspace {
  id: string;
  label: string;
}

export async function seedAppState(
  page: Page,
  tasks: StoredTask[],
  settings = testSettings,
  workspaces?: StoredWorkspace[],
) {
  await page.addInitScript(
    ({ tasks, settings, workspaces, tasksKey, settingsKey, workspacesKey }) => {
      window.localStorage.clear();
      window.localStorage.setItem(tasksKey, JSON.stringify(tasks));
      window.localStorage.setItem(settingsKey, JSON.stringify(settings));

      if (Array.isArray(workspaces)) {
        window.localStorage.setItem(workspacesKey, JSON.stringify(workspaces));
      }
    },
    {
      tasks,
      settings,
      workspaces,
      tasksKey: TASKS_STORAGE_KEY,
      settingsKey: SETTINGS_STORAGE_KEY,
      workspacesKey: WORKSPACES_STORAGE_KEY,
    },
  );
}

export async function gotoSeededPage(
  page: Page,
  tasks: StoredTask[],
  settings = testSettings,
  workspaces?: StoredWorkspace[],
) {
  await seedAppState(page, tasks, settings, workspaces);
  await page.goto('/');
}

