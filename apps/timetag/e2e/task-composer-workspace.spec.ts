import { expect, test, type Page } from '@playwright/test';
import { gotoSeededPage, type StoredWorkspace } from './helpers/seed-app';
import { testSettings } from './fixtures/timetag-state';
import type { AppSettings } from '@/domain/settings.types';

const DEFAULT_WORKSPACES: StoredWorkspace[] = [
  { id: 'work', label: 'Work' },
  { id: 'home', label: 'Home' },
];

const SINGLE_WORKSPACE: StoredWorkspace[] = [
  { id: 'work', label: 'Work' },
];

const HOME_ONLY_WORKSPACE: StoredWorkspace[] = [
  { id: 'home', label: 'Home' },
];

function taskRow(page: Page, title: string) {
  return page.getByTestId('task-row').filter({ hasText: title }).first();
}

function morePanel(page: Page) {
  return page.locator('#task-composer-more');
}

async function openMorePanel(page: Page) {
  await page.getByRole('button', { name: /more options/i }).click();
  const panel = morePanel(page);
  await panel.waitFor({ state: 'visible' });
  return panel;
}

async function openSettingsDefaultsTab(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Defaults' }).click();
}

test.describe('Task composer workspace override', () => {
  test('creates a task in Work while the UI stays in Home when workspace override is selected', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, DEFAULT_WORKSPACES);

    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');

    await page.getByLabel('Add a new task').fill('Override to Work task');
    await page.getByRole('button', { name: /^Toggle note$/i }).click();
    await page.locator('#task-note-inline-input').fill('Workspace override note');
    const panel = await openMorePanel(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByTitle('Workspace')).toContainText('Use current (Home)');

    await panel.getByText('Urgent', { exact: true }).click();
    await panel.getByTitle('Workspace').click();
    await page.getByRole('menuitem', { name: 'Work' }).click();
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
    await expect(taskRow(page, 'Override to Work task')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Work' }).click();
    const createdRow = taskRow(page, 'Override to Work task');
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByTestId('task-priority-bar')).toBeVisible();
    await expect(createdRow.getByTestId('task-note-preview')).toContainText('Workspace override note');
  });

  test('uses the last selected concrete workspace in panel after switching to All', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, DEFAULT_WORKSPACES);

    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');

    await page.getByLabel('Add a new task').fill('All keeps last selected workspace');
    const panel = await openMorePanel(page);
    await expect(panel.getByTitle('Workspace')).toBeVisible();
    await expect(panel.getByTitle('Workspace')).toContainText('Use last selected (Home)');
    await expect(panel.getByTitle('Workspace')).not.toContainText('Use current (Work)');

    await page.getByRole('button', { name: 'Apply' }).click();

    await page.getByRole('tab', { name: 'Work' }).click();
    await expect(taskRow(page, 'All keeps last selected workspace')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(taskRow(page, 'All keeps last selected workspace')).toBeVisible();
  });

  test('hides the workspace selector when only one workspace is available in a concrete workspace context', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, SINGLE_WORKSPACE);

    await page.getByRole('tab', { name: 'Work' }).click();
    const panel = await openMorePanel(page);

    await expect(panel.getByTitle('Workspace')).toHaveCount(0);
    await expect(panel.getByTestId('task-workspace-state')).toContainText('Work');
  });

  test('keeps the workspace selector visible in All context even when only one workspace is available', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, SINGLE_WORKSPACE);

    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    const panel = await openMorePanel(page);

    await expect(panel.getByTitle('Workspace')).toBeVisible();
    await expect(panel.getByTitle('Workspace')).toContainText('Use current (Work)');
  });

  test('uses an existing Home tab as current workspace in All context when Work does not exist', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, HOME_ONLY_WORKSPACE);

    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    const panel = await openMorePanel(page);

    await expect(panel.getByTitle('Workspace')).toBeVisible();
    await expect(panel.getByTitle('Workspace')).toContainText('Use current (Home)');
    await expect(panel.getByTitle('Workspace')).not.toContainText('Use current (Work)');
  });

  test('updates panel to the new current workspace when a workspace is created while panel is open', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, SINGLE_WORKSPACE);

    await page.getByRole('tab', { name: 'Work' }).click();
    const panel = await openMorePanel(page);
    await expect(panel.getByTestId('task-workspace-state')).toContainText('Work');

    await page.getByRole('button', { name: 'Add workspace' }).click();
    await page.getByPlaceholder('Workspace name').fill('Home');
    await page.getByRole('button', { name: 'Confirm add workspace' }).click();

    await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByTitle('Workspace')).toBeVisible();
    await expect(panel.getByTitle('Workspace')).toContainText('Use current (Home)');
    await expect(panel.getByTitle('Workspace')).not.toContainText('Use current (Work)');
  });

  test('updates the workspace selector immediately after a workspace is removed', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, DEFAULT_WORKSPACES);

    const panel = await openMorePanel(page);
    const workspaceButton = panel.getByTitle('Workspace');

    await expect(workspaceButton).toContainText('Use current (Work)');
    await workspaceButton.click();
    await expect(page.getByRole('menuitem', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove workspace Home' }).click();

    await expect(page.getByRole('menuitem', { name: 'Home' })).toHaveCount(0);
    await expect(workspaceButton).toContainText('Use current (Work)');

    await workspaceButton.click();
    await expect(page.getByRole('menuitem', { name: 'Home' })).toHaveCount(0);
  });

  test('does not allow removing the last remaining workspace', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, DEFAULT_WORKSPACES);

    await page.getByRole('button', { name: 'Remove workspace Home' }).click();
    const removeWorkButton = page.getByRole('button', { name: 'Remove workspace Work' });
    await expect(removeWorkButton).toBeDisabled();
    await expect(removeWorkButton).toHaveAttribute('aria-disabled', 'true');

    const panel = await openMorePanel(page);

    await expect(panel.getByTitle('Workspace')).toBeVisible();
    await expect(panel.getByTitle('Workspace')).toContainText('Use current (Work)');

    await page.getByRole('button', { name: 'Add workspace' }).click();
    await page.getByPlaceholder('Workspace name').fill('Focus');
    await page.getByRole('button', { name: 'Confirm add workspace' }).click();

    await expect(panel.getByTitle('Workspace')).toBeVisible();
    await expect(panel.getByTitle('Workspace')).toContainText('Use current (Focus)');
  });

  test('creates a task from All-only state using the default workspace fallback and never stores all', async ({ page }) => {
    const allOnlySettings: AppSettings = {
      ...testSettings,
      general: {
        ...testSettings.general,
        defaultWorkspace: 'home',
      },
    };

    await gotoSeededPage(
      page,
      [],
      allOnlySettings,
      [],
    );

    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await page.getByLabel('Add a new task').fill('All-only fallback task');
    const panel = await openMorePanel(page);
    await expect(panel.getByTitle('Workspace')).toHaveCount(0);
    await expect(panel.getByTestId('task-workspace-state')).toContainText('No workspace tabs available');
    await expect(panel).toContainText('Create a workspace tab');

    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(taskRow(page, 'All-only fallback task')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem('timetag-tasks');
      return raw ? JSON.parse(raw)[0]?.workspace : null;
    })).toBe('home');
  });

  test('syncs workspace tabs into settings defaults immediately', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, DEFAULT_WORKSPACES);

    await openSettingsDefaultsTab(page);
    await expect.poll(async () => page.getByLabel('Default workspace').locator('option').allTextContents()).toEqual(['Work', 'Home']);

    await page.evaluate(() => {
      window.localStorage.setItem('timetag-workspaces', JSON.stringify([{ id: 'work', label: 'Work' }]));
      window.dispatchEvent(new StorageEvent('storage', { key: 'timetag-workspaces' }));
    });

    await expect.poll(async () => page.getByLabel('Default workspace').locator('option').allTextContents()).toEqual(['Work']);
  });

  test('Use current resolves to a concrete workspace and never stores all', async ({ page }) => {
    await gotoSeededPage(page, [], testSettings, DEFAULT_WORKSPACES);

    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await page.getByLabel('Add a new task').fill('Use current workspace task');
    await page.getByRole('button', { name: /^Toggle note$/i }).click();
    await page.locator('#task-note-inline-input').fill('Preserves details fields');
    await page.getByRole('button', { name: /more options/i }).click();

    const panel = morePanel(page);
    await expect(panel.getByTitle('Workspace')).toContainText('Use current (Work)');
    await panel.getByText('Urgent', { exact: true }).click();
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect.poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem('timetag-tasks');
      return raw ? JSON.parse(raw)[0]?.workspace : null;
    })).toBe('work');

    await page.getByRole('tab', { name: 'Home' }).click();
    await expect(taskRow(page, 'Use current workspace task')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Work' }).click();
    const createdRow = taskRow(page, 'Use current workspace task');
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByTestId('task-priority-bar')).toBeVisible();
    await expect(createdRow.getByTestId('task-note-preview')).toContainText('Preserves details fields');
  });
});




