import { expect, test, type Page } from '@playwright/test';
import { gotoSeededPage } from './helpers/seed-app';
import { seededTasks, testSettings, type StoredTask } from './fixtures/timetag-state';

const SEEDED_TIMER_NOW_ISO = '2026-04-02T09:00:00.000Z';
const TIMER_DOUBLE_CLICK_SETTLE_MS = 350;

async function resolveCssValue(
  page: Page,
  variableName: string,
  property: 'color' | 'backgroundColor' | 'borderTopColor',
) {
  return page.evaluate(({ variableName, property }) => {
    const probe = document.createElement('div');
    probe.style.setProperty(property === 'backgroundColor' ? 'background-color' : property === 'borderTopColor' ? 'border-top-color' : 'color', `var(${variableName})`);
    document.body.appendChild(probe);
    const value = getComputedStyle(probe)[property as keyof CSSStyleDeclaration];
    probe.remove();
    return String(value);
  }, { variableName, property });
}

async function resolveCssExpression(
  page: Page,
  cssValue: string,
  property: 'color' | 'backgroundColor' | 'borderTopColor',
) {
  return page.evaluate(({ cssValue, property }) => {
    const probe = document.createElement('div');
    probe.style.setProperty(property === 'backgroundColor' ? 'background-color' : property === 'borderTopColor' ? 'border-top-color' : 'color', cssValue);
    document.body.appendChild(probe);
    const value = getComputedStyle(probe)[property as keyof CSSStyleDeclaration];
    probe.remove();
    return String(value);
  }, { cssValue, property });
}

function taskRow(page: Page, title: string) {
  return page.getByTestId('task-row').filter({ hasText: title }).first();
}

function morePanel(page: Page) {
  return page.locator('#task-composer-more');
}

function createStoredTask(overrides: Partial<StoredTask> & Pick<StoredTask, 'id' | 'title'>): StoredTask {
  const { id, title, timerControls, ...rest } = overrides;

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
      ...timerControls,
    },
    reminders: [],
    createdAt: SEEDED_TIMER_NOW_ISO,
    updatedAt: SEEDED_TIMER_NOW_ISO,
    ...rest,
  };
}

async function readStoredTimerState(page: Page, title: string) {
  return page.evaluate((taskTitle) => {
    const raw = window.localStorage.getItem('timetag-tasks');
    if (!raw) {
      return null;
    }

    const storedTask = JSON.parse(raw).find((task: { title?: string }) => task.title === taskTitle);
    if (!storedTask) {
      return null;
    }

    return {
      status: storedTask.status,
      timerMode: storedTask.timerMode,
      remainingSec: storedTask.remainingSec,
      originalDurationSec: storedTask.originalDurationSec,
      timerStatus: storedTask.timerStatus,
    };
  }, title);
}

test.describe('Task row states', () => {
  test('renders seeded urgent, note, and completed tasks consistently', async ({ page }) => {
    await gotoSeededPage(page, seededTasks);

    const expectedUrgentBar = await resolveCssExpression(
      page,
      'color-mix(in srgb, var(--tt-text-muted) 54%, white)',
      'backgroundColor',
    );

    const urgentRow = taskRow(page, 'Urgent note task');
    await expect(urgentRow).toBeVisible();
    await expect(urgentRow.getByTestId('task-priority-slot')).toBeVisible();
    await expect(urgentRow.getByTestId('task-content-block')).toBeVisible();
    await expect(urgentRow.getByTestId('task-priority-bar')).toBeVisible();
    await expect(urgentRow.getByTestId('task-note-trigger')).toHaveCount(0);
    await expect(urgentRow.getByTestId('task-note-preview')).toContainText('Important follow-up note');

    const urgentTitle = urgentRow.getByTestId('task-title');
    const urgentBar = urgentRow.getByTestId('task-priority-bar');
    const urgentContentBlock = urgentRow.getByTestId('task-content-block');
    const urgentNotePreview = urgentRow.getByTestId('task-note-preview');
    const titleBox = await urgentTitle.boundingBox();
    const barBox = await urgentBar.boundingBox();
    const contentBox = await urgentContentBlock.boundingBox();
    const noteBox = await urgentNotePreview.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(noteBox).not.toBeNull();
    await expect(urgentBar).toHaveCSS('background-color', expectedUrgentBar);
    expect((barBox?.x ?? 0)).toBeLessThan((contentBox?.x ?? 0));
    expect((contentBox?.height ?? 0)).toBeGreaterThan(38);
    expect(Math.abs((barBox?.height ?? 0) - 32)).toBeLessThan(2);
    expect((barBox?.width ?? 0)).toBeLessThan(2.5);
    expect((barBox?.height ?? 0)).toBeGreaterThan((titleBox?.height ?? 0) + 10);
    expect((noteBox?.y ?? 0) ?? 0).toBeGreaterThan((titleBox?.y ?? 0) ?? 0);
    expect(Math.abs((noteBox?.x ?? 0) - (titleBox?.x ?? 0))).toBeLessThan(4);

    const urgentPlainRow = taskRow(page, 'Urgent plain task');
    await expect(urgentPlainRow).toBeVisible();
    await expect(urgentPlainRow.getByTestId('task-priority-slot')).toBeVisible();
    await expect(urgentPlainRow.getByTestId('task-priority-bar')).toBeVisible();
    await expect(urgentPlainRow.getByTestId('task-note-preview')).toHaveCount(0);

    const urgentPlainBar = urgentPlainRow.getByTestId('task-priority-bar');
    const urgentPlainTitle = urgentPlainRow.getByTestId('task-title');
    const urgentPlainContent = urgentPlainRow.getByTestId('task-content-block');
    const urgentPlainBarBox = await urgentPlainBar.boundingBox();
    const urgentPlainTitleBox = await urgentPlainTitle.boundingBox();
    const urgentPlainContentBox = await urgentPlainContent.boundingBox();
    expect(urgentPlainBarBox).not.toBeNull();
    expect(urgentPlainTitleBox).not.toBeNull();
    expect(urgentPlainContentBox).not.toBeNull();
    expect(Math.abs((urgentPlainBarBox?.height ?? 0) - (barBox?.height ?? 0))).toBeLessThan(2);
    expect(Math.abs((urgentPlainContentBox?.height ?? 0) - (contentBox?.height ?? 0))).toBeLessThan(2);

    const plainRow = taskRow(page, 'Plain task');
    await expect(plainRow).toBeVisible();
    await expect(plainRow.getByTestId('task-priority-slot')).toBeVisible();
    await expect(plainRow.getByTestId('task-content-block')).toBeVisible();
    await expect(plainRow.getByTestId('task-priority-bar')).toHaveCount(0);
    await expect(plainRow.getByTestId('task-note-preview')).toHaveCount(0);

    const plainTitle = plainRow.getByTestId('task-title');
    const plainTitleBox = await plainTitle.boundingBox();
    expect(plainTitleBox).not.toBeNull();
    expect(Math.abs((plainTitleBox?.x ?? 0) - (titleBox?.x ?? 0))).toBeLessThan(4);
    expect(Math.abs((plainTitleBox?.x ?? 0) - (urgentPlainTitleBox?.x ?? 0))).toBeLessThan(4);

    const completedRow = taskRow(page, 'Completed task with note');
    await expect(completedRow).toBeVisible();
    await expect(completedRow.getByTestId('task-status-toggle')).toBeVisible();
    await expect(completedRow.getByTestId('task-title')).toHaveCSS('text-decoration-line', 'line-through');
    await expect(completedRow.getByTestId('task-note-preview')).toContainText('Completed note content');
  });

  test('shows Variant B hover affordances for select and done controls', async ({ page }) => {
    await gotoSeededPage(page, seededTasks);

    const row = taskRow(page, 'Urgent note task');
    const selectionCheckbox = row.getByTestId('task-selection-checkbox');
    const selectionMarker = row.getByTestId('task-selection-checkbox-marker');
    const statusToggle = row.getByTestId('task-status-toggle');
    const expectedAccentHoverBorder = await resolveCssValue(page, '--tt-accent-hover', 'borderTopColor');
    const expectedAccentSoftBackground = await resolveCssValue(page, '--tt-accent-soft', 'backgroundColor');
    const expectedAccentText = await resolveCssValue(page, '--tt-accent', 'color');

    await expect(selectionCheckbox).toHaveCSS('border-top-color', 'rgba(215, 222, 231, 0.78)');
    await expect(selectionCheckbox).toHaveCSS('border-top-width', '1px');
    await expect(selectionMarker).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.68)');
    await expect(selectionMarker).toHaveCSS('border-top-color', 'rgba(71, 85, 105, 0.76)');
    await expect(selectionMarker).toHaveCSS('border-top-width', '1px');
    await expect(selectionMarker).toHaveCSS('border-top-left-radius', '2px');
    await selectionCheckbox.hover();
    await expect(selectionCheckbox).toHaveCSS('border-top-color', 'rgba(79, 125, 243, 0.76)');
    await expect(selectionMarker).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.82)');
    await expect(selectionMarker).toHaveCSS('border-top-color', 'rgba(51, 65, 85, 0.84)');

    await expect(statusToggle).toHaveCSS('border-top-color', 'rgb(215, 222, 231)');
    await expect(statusToggle).toHaveCSS('border-top-width', '2px');
    await statusToggle.hover();
    await expect(statusToggle).toHaveCSS('border-top-color', expectedAccentHoverBorder);
    await expect(statusToggle).toHaveCSS('border-top-width', '1px');
    await expect(statusToggle).toHaveCSS('background-color', expectedAccentSoftBackground);
    await expect(statusToggle).toHaveCSS('color', expectedAccentText);
    await expect(statusToggle).toHaveCSS('box-shadow', 'none');
  });

  test('adds a task with urgent priority and note, then marks it completed', async ({ page }) => {
    await gotoSeededPage(page, []);

    const expectedMutedBar = await resolveCssExpression(
      page,
      'color-mix(in srgb, var(--tt-text-soft) 42%, white)',
      'backgroundColor',
    );

    await page.getByLabel('Add a new task').fill('Playwright urgent task');
    await page.getByRole('button', { name: /^Toggle note$/i }).click();
    await page.locator('#task-note-inline-input').fill('Created from Playwright test');
    await page.getByRole('button', { name: /^Details$/i }).click();
    const panel = morePanel(page);
    await panel.getByText('Urgent', { exact: true }).click();
    await panel.getByRole('button', { name: /create task/i }).click();

    const createdRow = taskRow(page, 'Playwright urgent task');
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByTestId('task-priority-slot')).toBeVisible();
    await expect(createdRow.getByTestId('task-content-block')).toBeVisible();
    await expect(createdRow.getByTestId('task-priority-bar')).toBeVisible();
    await expect(createdRow.getByTestId('task-note-trigger')).toHaveCount(0);
    await expect(createdRow.getByTestId('task-note-preview')).toContainText('Created from Playwright test');

    await createdRow.getByTestId('task-status-toggle').evaluate((element: HTMLButtonElement) => element.click());
    await expect(createdRow.getByTestId('task-status-toggle')).toHaveAttribute('aria-label', 'Mark as active');
    await expect(createdRow.getByTestId('task-title')).toHaveCSS('text-decoration-line', 'line-through');
    await expect(createdRow.getByTestId('task-priority-bar')).toHaveCSS('background-color', expectedMutedBar);
  });

  test('creates untimed note entries without timer affordances and persists note mode safely', async ({ page }) => {
    await gotoSeededPage(page, []);

    await page.getByLabel('Add a new task').fill('Playwright note entry');
    await page.getByTitle('Timer mode').click();
    await page.getByRole('menuitem', { name: 'Note' }).click();
    await expect(page.locator('#task-note-inline-input')).toHaveCount(0);
    await page.getByRole('button', { name: /^Toggle note$/i }).click();
    await expect(page.locator('#task-note-inline-input')).toBeVisible();
    await page.locator('#task-note-inline-input').fill('Created as an untimed note entry');
    await page.getByRole('button', { name: 'Add task' }).click();

    const createdRow = taskRow(page, 'Playwright note entry');
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByTestId('ghost-timer')).toBeVisible();
    await expect(createdRow.getByTestId('ghost-timer')).toContainText('no timer');
    await expect(createdRow.getByTestId('task-timer-cluster')).toHaveCount(0);
    await expect(createdRow.getByLabel('Start timer')).toHaveCount(0);
    await expect(createdRow.getByLabel('Pause timer')).toHaveCount(0);

    await createdRow.locator('button[aria-haspopup="true"]').click();
    await expect(page.getByRole('menuitem', { name: 'Reset timer' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await expect.poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem('timetag-tasks');
      if (!raw) return null;

      const storedTask = JSON.parse(raw).find((task: { title?: string }) => task.title === 'Playwright note entry');
      if (!storedTask) return null;

      return {
        timerMode: storedTask.timerMode,
        remainingSec: storedTask.remainingSec,
        originalDurationSec: storedTask.originalDurationSec,
        timerControls: storedTask.timerControls ?? null,
      };
    })).toEqual({
      timerMode: 'note',
      remainingSec: 0,
      originalDurationSec: 0,
      timerControls: null,
    });
  });

  test('applies advanced composer settings and keeps timer mode in sync with quick controls', async ({ page }) => {
    await gotoSeededPage(page, []);

    await page.getByLabel('Add a new task').fill('Playwright advanced apply task');
    await page.getByRole('button', { name: /^Details$/i }).click();

    const panel = morePanel(page);
    await expect(panel).toBeVisible();
    const moreModeButton = panel.locator('#task-more-mode-btn');
    await expect(moreModeButton).toContainText('Duration');

    await moreModeButton.click();
    await panel.getByRole('menuitem', { name: 'Pomodoro' }).click();
    await expect(moreModeButton).toContainText('Pomodoro');
    await expect(page.locator('#task-mode-btn')).toContainText('Pomodoro');

    await panel.getByRole('button', { name: 'Cancel' }).click();
    await expect(panel).toBeHidden();
    await expect(taskRow(page, 'Playwright advanced apply task')).toHaveCount(0);

    await page.getByRole('button', { name: /^Details$/i }).click();
    await expect(panel.locator('#task-more-mode-btn')).toContainText('Pomodoro');
    await panel.getByRole('button', { name: 'Create task' }).click();

    const createdRow = taskRow(page, 'Playwright advanced apply task');
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByLabel('Start timer')).toBeVisible();
  });

  test('double-clicking the timer control restarts active timers across supported states', async ({ page }) => {
    const restartableTasks: StoredTask[] = [
      createStoredTask({
        id: 'restart-idle',
        title: 'Restart idle task',
        remainingSec: 600,
        originalDurationSec: 1500,
        timerStatus: 'idle',
      }),
      createStoredTask({
        id: 'restart-running',
        title: 'Restart running task',
        remainingSec: 480,
        originalDurationSec: 900,
        timerStatus: 'running',
      }),
      createStoredTask({
        id: 'restart-paused',
        title: 'Restart paused task',
        remainingSec: 300,
        originalDurationSec: 1200,
        timerStatus: 'paused',
      }),
      createStoredTask({
        id: 'restart-finished',
        title: 'Restart finished task',
        remainingSec: 0,
        originalDurationSec: 600,
        timerStatus: 'expired',
      }),
      createStoredTask({
        id: 'restart-overdue',
        title: 'Restart overdue task',
        remainingSec: -120,
        originalDurationSec: 600,
        timerStatus: 'running',
        timerControls: {
          autoStart: false,
          autoPlay: false,
          autoReset: false,
          allowOverdue: true,
        },
      }),
      {
        id: 'restart-note',
        title: 'Restart note task',
        workspace: 'work',
        status: 'active',
        priority: 'normal',
        timerMode: 'note',
        remainingSec: 0,
        originalDurationSec: 0,
        timerStatus: 'idle',
        reminders: [],
        createdAt: SEEDED_TIMER_NOW_ISO,
        updatedAt: SEEDED_TIMER_NOW_ISO,
      },
    ];

    await gotoSeededPage(page, restartableTasks);

    const noteRow = taskRow(page, 'Restart note task');
    await expect(noteRow.getByTestId('ghost-timer')).toBeVisible();
    await expect(noteRow.getByTestId('task-timer-cluster')).toHaveCount(0);
    await expect(noteRow.getByLabel('Start timer')).toHaveCount(0);
    await expect(noteRow.getByLabel('Pause timer')).toHaveCount(0);

    const restartCases = [
      {
        title: 'Restart idle task',
        accessibleName: 'Start timer',
        expected: {
          status: 'active',
          timerMode: 'duration',
          remainingSec: 1500,
          originalDurationSec: 1500,
          timerStatus: 'idle',
        },
      },
      {
        title: 'Restart running task',
        accessibleName: 'Pause timer',
        expected: {
          status: 'active',
          timerMode: 'duration',
          remainingSec: 900,
          originalDurationSec: 900,
          timerStatus: 'idle',
        },
      },
      {
        title: 'Restart paused task',
        accessibleName: 'Start timer',
        expected: {
          status: 'active',
          timerMode: 'duration',
          remainingSec: 1200,
          originalDurationSec: 1200,
          timerStatus: 'idle',
        },
      },
      {
        title: 'Restart finished task',
        accessibleName: 'Start timer',
        expected: {
          status: 'active',
          timerMode: 'duration',
          remainingSec: 600,
          originalDurationSec: 600,
          timerStatus: 'idle',
        },
      },
      {
        title: 'Restart overdue task',
        accessibleName: 'Pause timer',
        expected: {
          status: 'active',
          timerMode: 'duration',
          remainingSec: 600,
          originalDurationSec: 600,
          timerStatus: 'idle',
        },
      },
    ] as const;

    for (const restartCase of restartCases) {
      const row = taskRow(page, restartCase.title);
      await expect(row).toBeVisible();
      await row.getByLabel(restartCase.accessibleName).dblclick();
      await page.waitForTimeout(TIMER_DOUBLE_CLICK_SETTLE_MS);

      await expect.poll(async () => readStoredTimerState(page, restartCase.title)).toEqual(restartCase.expected);
      await expect(row.getByLabel('Start timer')).toBeVisible();
    }
  });

  test('single click still toggles timer while done and archived rows keep restart disabled', async ({ page }) => {
    const tasks: StoredTask[] = [
      createStoredTask({
        id: 'single-click-timer',
        title: 'Single click timer task',
        remainingSec: 600,
        originalDurationSec: 1200,
        timerStatus: 'idle',
      }),
      createStoredTask({
        id: 'done-restart-guard',
        title: 'Done restart guard task',
        status: 'done',
        remainingSec: 240,
        originalDurationSec: 600,
        timerStatus: 'paused',
      }),
      createStoredTask({
        id: 'archived-restart-guard',
        title: 'Archived restart guard task',
        status: 'archived',
        remainingSec: 180,
        originalDurationSec: 600,
        timerStatus: 'paused',
      }),
    ];

    await gotoSeededPage(page, tasks);

    const singleClickRow = taskRow(page, 'Single click timer task');
    await singleClickRow.getByLabel('Start timer').click();
    await page.waitForTimeout(TIMER_DOUBLE_CLICK_SETTLE_MS);

    await expect.poll(async () => readStoredTimerState(page, 'Single click timer task')).toEqual({
      status: 'active',
      timerMode: 'duration',
      remainingSec: 600,
      originalDurationSec: 1200,
      timerStatus: 'running',
    });
    await expect(singleClickRow.getByLabel('Pause timer')).toBeVisible();

    const doneRow = taskRow(page, 'Done restart guard task');
    const archivedRow = taskRow(page, 'Archived restart guard task');

    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(doneRow.getByLabel('Start timer')).toBeDisabled();

    await page.getByRole('button', { name: 'Archived', exact: true }).click();
    await expect(archivedRow.getByLabel('Start timer')).toBeDisabled();

    await expect.poll(async () => readStoredTimerState(page, 'Done restart guard task')).toEqual({
      status: 'done',
      timerMode: 'duration',
      remainingSec: 240,
      originalDurationSec: 600,
      timerStatus: 'paused',
    });
    await expect.poll(async () => readStoredTimerState(page, 'Archived restart guard task')).toEqual({
      status: 'archived',
      timerMode: 'duration',
      remainingSec: 180,
      originalDurationSec: 600,
      timerStatus: 'paused',
    });
  });

  test('task row reset menu keeps working with timer restart support', async ({ page }) => {
    const tasks: StoredTask[] = [
      createStoredTask({
        id: 'menu-reset-task',
        title: 'Menu reset task',
        remainingSec: 420,
        originalDurationSec: 900,
        timerStatus: 'paused',
      }),
    ];

    await gotoSeededPage(page, tasks);

    const row = taskRow(page, 'Menu reset task');
    await row.locator('button[aria-haspopup="true"]').click();
    await page.getByRole('menuitem', { name: 'Reset timer' }).click();

    await expect.poll(async () => readStoredTimerState(page, 'Menu reset task')).toEqual({
      status: 'active',
      timerMode: 'duration',
      remainingSec: 900,
      originalDurationSec: 900,
      timerStatus: 'idle',
    });
    await expect(row.getByLabel('Start timer')).toBeVisible();
  });

  test('keeps note discoverability when note previews are disabled', async ({ page }) => {
    await gotoSeededPage(page, seededTasks, {
      ...testSettings,
      general: {
        ...testSettings.general,
        showUrgencyIndicator: false,
        showNotePreviewsInTaskList: false,
      },
    });

    const noteRow = taskRow(page, 'Urgent note task');
    const plainRow = taskRow(page, 'Plain task');

    await expect(noteRow).toBeVisible();
    await expect(noteRow.getByTestId('task-note-preview')).toHaveCount(0);
    await expect(noteRow.getByTestId('task-priority-slot')).toHaveCount(0);
    await expect(noteRow.getByTestId('task-note-slot')).toBeVisible();
    await expect(noteRow.getByTestId('task-note-indicator')).toBeVisible();
    await expect(noteRow.getByTestId('task-note-indicator')).toHaveAttribute('title', 'Important follow-up note');

    await expect(plainRow).toBeVisible();
    await expect(plainRow.getByTestId('task-priority-slot')).toHaveCount(0);
    await expect(plainRow.getByTestId('task-note-slot')).toBeVisible();
    await expect(plainRow.getByTestId('task-note-indicator')).toHaveCount(0);

    const noteTitleBox = await noteRow.getByTestId('task-title').boundingBox();
    const plainTitleBox = await plainRow.getByTestId('task-title').boundingBox();
    expect(noteTitleBox).not.toBeNull();
    expect(plainTitleBox).not.toBeNull();
    expect(Math.abs((noteTitleBox?.x ?? 0) - (plainTitleBox?.x ?? 0))).toBeLessThan(4);
  });

  test('removes the priority gutter when urgency indicators are disabled', async ({ page }) => {
    await gotoSeededPage(page, seededTasks);

    const enabledUrgentTitleBox = await taskRow(page, 'Urgent note task').getByTestId('task-title').boundingBox();
    expect(enabledUrgentTitleBox).not.toBeNull();

    await gotoSeededPage(page, seededTasks, {
      ...testSettings,
      general: {
        ...testSettings.general,
        showUrgencyIndicator: false,
      },
    });

    const urgentRow = taskRow(page, 'Urgent note task');
    const plainRow = taskRow(page, 'Plain task');

    await expect(urgentRow).toBeVisible();
    await expect(urgentRow.getByTestId('task-priority-slot')).toHaveCount(0);
    await expect(urgentRow.getByTestId('task-priority-bar')).toHaveCount(0);
    await expect(urgentRow.getByTestId('task-note-slot')).toHaveCount(0);

    await expect(plainRow).toBeVisible();
    await expect(plainRow.getByTestId('task-priority-slot')).toHaveCount(0);
    await expect(plainRow.getByTestId('task-priority-bar')).toHaveCount(0);
    await expect(plainRow.getByTestId('task-note-slot')).toHaveCount(0);

    const disabledUrgentTitleBox = await urgentRow.getByTestId('task-title').boundingBox();
    const disabledPlainTitleBox = await plainRow.getByTestId('task-title').boundingBox();
    expect(disabledUrgentTitleBox).not.toBeNull();
    expect(disabledPlainTitleBox).not.toBeNull();
    expect(Math.abs((disabledUrgentTitleBox?.x ?? 0) - (disabledPlainTitleBox?.x ?? 0))).toBeLessThan(4);
    expect((enabledUrgentTitleBox?.x ?? 0) - (disabledUrgentTitleBox?.x ?? 0)).toBeGreaterThan(8);
  });
});





