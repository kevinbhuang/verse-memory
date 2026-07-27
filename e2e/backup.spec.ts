import { expect, test } from '@playwright/test';

const FIRST_PASSAGE = 'Exodus 19:4-6';
const SECOND_PASSAGE = 'Deuteronomy 6:4-5';

test('export, reset and restore brings progress back', async ({ page }) => {
  await page.goto('/verses');
  const first = page.getByRole('checkbox', {
    name: `Mark ${FIRST_PASSAGE} as memorized`,
  });
  const second = page.getByRole('checkbox', {
    name: `Mark ${SECOND_PASSAGE} as memorized`,
  });

  await first.click();
  await expect(first).toBeChecked();
  await second.click();
  await expect(second).toBeChecked();

  await page.goto('/more');

  const download = await Promise.race([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: 'Export all data (JSON)' })
      .click()
      .then(() => page.waitForEvent('download')),
  ]);
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  // The backup carries progress, not the copyrighted Scripture text.
  const contents = await download
    .createReadStream()
    .then(async (stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks).toString('utf8');
    });
  expect(contents).toContain('"verse-001"');
  expect(contents).not.toContain('bore you on eagles');

  await page.getByRole('button', { name: 'Reset all progress' }).click();
  await page.getByRole('button', { name: 'Delete all my progress' }).click();
  await expect(page.getByText('All progress has been reset.')).toBeVisible();

  await page.goto('/verses');
  await expect(
    page.getByRole('checkbox', { name: `Mark ${FIRST_PASSAGE} as memorized` }),
  ).not.toBeChecked();

  await page.goto('/more');
  await page
    .locator('input[type="file"]')
    .setInputFiles(backupPath as string);

  await expect(page.getByText('Review this import')).toBeVisible();
  await expect(page.getByText('Nothing has been written yet.')).toBeVisible();
  await page.getByRole('button', { name: /Merge into my data/ }).click();

  await expect(page.getByText(/Imported \d+ passage records/)).toBeVisible();

  await page.goto('/verses');
  await expect(
    page.getByRole('checkbox', { name: `Mark ${FIRST_PASSAGE} as memorized` }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: `Mark ${SECOND_PASSAGE} as memorized` }),
  ).toBeChecked();
});

test('an unreadable file is refused with an explanation', async ({ page }) => {
  await page.goto('/more');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'not-a-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('this is not json'),
  });

  await expect(page.getByRole('alert')).toContainText(
    'This file could not be imported.',
  );
  await expect(page.getByText('Review this import')).toBeHidden();
});
