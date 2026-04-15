import { expect, test, type Page } from '@playwright/test';
import { gotoSeededPage } from './helpers/seed-app';
import { seededTasks } from './fixtures/timetag-state';

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

function taskRow(page: Page, title: string) {
  return page.getByTestId('task-row').filter({ hasText: title }).first();
}

test.describe('Task row states', () => {
  test('renders seeded urgent, note, and completed tasks consistently', async ({ page }) => {
    await gotoSeededPage(page, seededTasks);

    const urgentRow = taskRow(page, 'Urgent note task');
    await expect(urgentRow).toBeVisible();
    await expect(urgentRow.getByTestId('task-meta-cluster')).toBeVisible();
    await expect(urgentRow.getByTestId('task-urgent-icon')).toBeVisible();
    await expect(urgentRow.getByTestId('task-note-trigger')).toBeVisible();
    await expect(urgentRow.getByTestId('task-note-trigger')).toHaveAttribute('title', 'Important follow-up note');
    await expect(urgentRow.getByTestId('task-note-preview')).toContainText('Important follow-up note');

    const urgentTitle = urgentRow.getByTestId('task-title');
    const urgentNotePreview = urgentRow.getByTestId('task-note-preview');
    const titleBox = await urgentTitle.boundingBox();
    const noteBox = await urgentNotePreview.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(noteBox).not.toBeNull();
    expect((noteBox?.y ?? 0) ?? 0).toBeGreaterThan((titleBox?.y ?? 0) ?? 0);
    expect(Math.abs((noteBox?.x ?? 0) - (titleBox?.x ?? 0))).toBeLessThan(4);

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

    await page.getByLabel('Add a new task').fill('Playwright urgent task');
    await page.getByRole('button', { name: /details/i }).click();
    await page.getByText('Urgent', { exact: true }).click();
    await page.getByLabel('Note').fill('Created from Playwright test');
    await page.getByRole('button', { name: 'Save' }).click();

    const createdRow = taskRow(page, 'Playwright urgent task');
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByTestId('task-meta-cluster')).toBeVisible();
    await expect(createdRow.getByTestId('task-urgent-icon')).toBeVisible();
    await expect(createdRow.getByTestId('task-note-preview')).toContainText('Created from Playwright test');

    await createdRow.getByTestId('task-status-toggle').evaluate((element: HTMLButtonElement) => element.click());
    await expect(createdRow.getByTestId('task-status-toggle')).toHaveAttribute('aria-label', 'Mark as active');
    await expect(createdRow.getByTestId('task-title')).toHaveCSS('text-decoration-line', 'line-through');
  });
});





