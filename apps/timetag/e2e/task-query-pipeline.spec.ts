import { expect, test, type Page } from '@playwright/test';
import { gotoSeededPage } from './helpers/seed-app';
import { seededTasks, type StoredTask } from './fixtures/timetag-state';

const ISO_NOW = '2026-04-02T09:00:00.000Z';

function createTask(overrides: Partial<StoredTask> & Pick<StoredTask, 'id' | 'title'>): StoredTask {
  const { id, title, ...rest } = overrides;

  return {
    id,
    title,
    workspace: 'work',
    status: 'active',
    priority: 'normal',
    timerMode: 'duration',
    remainingSec: 1500,
    originalDurationSec: 1500,
    timerStatus: 'idle',
    timerControls: {
      autoStart: false,
      autoPlay: false,
      autoReset: false,
      allowOverdue: false,
    },
    reminders: [],
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
    ...rest,
  };
}

function taskRow(page: Page, title: string) {
  return page.getByTestId('task-row').filter({ hasText: title }).first();
}

async function visibleTitles(page: Page) {
  return page.getByTestId('task-title').allInnerTexts();
}

test.describe('Task query pipeline', () => {
  test('keeps archived tasks out of Active while Done and Archived tabs stay explicit', async ({ page }) => {
    const tasks = [
      createTask({ id: 'status-active', title: 'Status active task', status: 'active' }),
      createTask({ id: 'status-done', title: 'Status done task', status: 'done', timerStatus: 'paused' }),
      createTask({ id: 'status-archived', title: 'Status archived task', status: 'archived', timerStatus: 'paused' }),
    ];

    await gotoSeededPage(page, tasks);

    await expect(taskRow(page, 'Status active task')).toBeVisible();
    await expect(taskRow(page, 'Status done task')).toBeVisible();
    await expect(taskRow(page, 'Status archived task')).toHaveCount(0);

    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(taskRow(page, 'Status done task')).toBeVisible();
    await expect(taskRow(page, 'Status active task')).toHaveCount(0);
    await expect(taskRow(page, 'Status archived task')).toHaveCount(0);

    await page.getByRole('button', { name: 'Archived', exact: true }).click();
    await expect(taskRow(page, 'Status archived task')).toBeVisible();
    await expect(taskRow(page, 'Status active task')).toHaveCount(0);
    await expect(taskRow(page, 'Status done task')).toHaveCount(0);

    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await expect(taskRow(page, 'Status active task')).toBeVisible();
    await expect(taskRow(page, 'Status done task')).toBeVisible();
    await expect(taskRow(page, 'Status archived task')).toHaveCount(0);
  });

  test('keeps workspace context separate from status filtering', async ({ page }) => {
    const tasks = [
      createTask({ id: 'work-active', title: 'Work active task', workspace: 'work', status: 'active' }),
      createTask({ id: 'work-done', title: 'Work done task', workspace: 'work', status: 'done', timerStatus: 'paused' }),
      createTask({ id: 'home-active', title: 'Home active task', workspace: 'home', status: 'active' }),
      createTask({ id: 'home-done', title: 'Home done task', workspace: 'home', status: 'done', timerStatus: 'paused' }),
    ];

    await gotoSeededPage(page, tasks);

    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(taskRow(page, 'Home active task')).toBeVisible();
    await expect(taskRow(page, 'Home done task')).toBeVisible();
    await expect(taskRow(page, 'Work active task')).toHaveCount(0);
    await expect(taskRow(page, 'Work done task')).toHaveCount(0);

    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(taskRow(page, 'Home done task')).toBeVisible();
    await expect(taskRow(page, 'Home active task')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Work' }).click();
    await expect(taskRow(page, 'Work done task')).toBeVisible();
    await expect(taskRow(page, 'Home done task')).toHaveCount(0);
  });

  test('applies search, filter, and sort through shared query controls', async ({ page }) => {
    const tasks = [
      createTask({ id: 'alpha-reminder', title: 'Alpha reminder', reminders: [{ id: 'r1', enabled: true }] }),
      createTask({ id: 'beta-plain', title: 'Beta plain' }),
      createTask({ id: 'gamma-plain', title: 'Gamma plain' }),
    ];

    await gotoSeededPage(page, tasks);

    await page.getByLabel('Search tasks').fill('plain');
    await expect(taskRow(page, 'Alpha reminder')).toHaveCount(0);
    await expect(taskRow(page, 'Beta plain')).toBeVisible();
    await expect(taskRow(page, 'Gamma plain')).toBeVisible();

    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(taskRow(page, 'Beta plain')).toBeVisible();
    await expect(taskRow(page, 'Gamma plain')).toBeVisible();

    await page.getByRole('button', { name: /sort/i }).click();
    await page.getByRole('menuitem', { name: /Title/i }).click();
    await expect.poll(async () => visibleTitles(page)).toEqual(['Beta plain', 'Gamma plain']);

    await page.getByRole('button', { name: /sort/i }).click();
    await page.getByRole('menuitem', { name: /Title/i }).click();
    await expect.poll(async () => visibleTitles(page)).toEqual(['Gamma plain', 'Beta plain']);
  });

  test('timer controls reflect store-driven status changes', async ({ page }) => {
    await gotoSeededPage(page, seededTasks);

    const row = taskRow(page, 'Urgent note task');
    const timerButton = row.getByLabel('Pause timer');
    await expect(timerButton).toBeEnabled();

    await row.getByTestId('task-status-toggle').evaluate((element: HTMLButtonElement) => element.click());
    await expect(row.getByLabel('Start timer')).toBeDisabled();

    await row.getByTestId('task-status-toggle').evaluate((element: HTMLButtonElement) => element.click());
    await expect(row.getByLabel('Start timer')).toBeEnabled();
  });
});

