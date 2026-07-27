import { expect, test, type Page } from '@playwright/test';

const FIRST_PASSAGE = 'Exodus 19:4-6';

const memorizedCheckbox = (page: Page, reference: string) =>
  page.getByRole('checkbox', { name: `Mark ${reference} as memorized` });

test.describe('marking a passage memorized', () => {
  test('survives a reload', async ({ page }) => {
    await page.goto('/verses');

    const checkbox = memorizedCheckbox(page, FIRST_PASSAGE);
    await expect(checkbox).not.toBeChecked();

    await checkbox.click();
    await expect(
      page.getByText(/first retention review scheduled for tomorrow/i),
    ).toBeVisible();
    await expect(checkbox).toBeChecked();

    await page.reload();

    await expect(memorizedCheckbox(page, FIRST_PASSAGE)).toBeChecked();
  });

  test('counts towards the dashboard total', async ({ page }) => {
    await page.goto('/verses');
    await memorizedCheckbox(page, FIRST_PASSAGE).click();
    await expect(memorizedCheckbox(page, FIRST_PASSAGE)).toBeChecked();

    await page.goto('/');

    await expect(page.getByText('1 of 171').first()).toBeVisible();
  });

  test('can be undone without losing the passage', async ({ page }) => {
    await page.goto('/verses');
    const checkbox = memorizedCheckbox(page, FIRST_PASSAGE);

    await checkbox.click();
    await expect(checkbox).toBeChecked();

    await checkbox.click();
    await expect(checkbox).not.toBeChecked();

    await page.reload();

    await expect(memorizedCheckbox(page, FIRST_PASSAGE)).not.toBeChecked();
    await expect(page.getByRole('link', { name: FIRST_PASSAGE })).toBeVisible();
  });
});
