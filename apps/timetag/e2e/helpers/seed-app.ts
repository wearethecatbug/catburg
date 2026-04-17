import type { Page } from '@playwright/test';
import { SETTINGS_STORAGE_KEY, TASKS_STORAGE_KEY, testSettings, type StoredTask } from '../fixtures/timetag-state';

export async function seedAppState(page: Page, tasks: StoredTask[], settings = testSettings) {
  await page.addInitScript(
    ({ tasks, settings, tasksKey, settingsKey }) => {
      window.localStorage.clear();
      window.localStorage.setItem(tasksKey, JSON.stringify(tasks));
      window.localStorage.setItem(settingsKey, JSON.stringify(settings));
    },
    {
      tasks,
      settings,
      tasksKey: TASKS_STORAGE_KEY,
      settingsKey: SETTINGS_STORAGE_KEY,
    },
  );
}

export async function gotoSeededPage(page: Page, tasks: StoredTask[], settings = testSettings) {
  await seedAppState(page, tasks, settings);
  await page.goto('/');
}

