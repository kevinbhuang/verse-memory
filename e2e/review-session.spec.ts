import { expect, test, type Page } from '@playwright/test';

const FIRST_PASSAGE = 'Exodus 19:4-6';

/**
 * Builds a one-passage session that always uses first-letter typing, so the
 * exercise under test does not depend on the passage's learning stage.
 */
async function startFirstLetterSession(page: Page) {
  await page.goto('/review');

  await page.getByRole('button', { name: 'Passage number range' }).click();
  const end = page.getByLabel('To passage');
  await end.fill('1');

  await page.getByRole('button', { name: 'One mode for the session' }).click();
  await page.getByLabel('Mode', { exact: true }).selectOption('first-letter');

  await expect(page.getByText('1 passage in this session')).toBeVisible();
  await page.getByRole('button', { name: 'Start session' }).click();

  await expect(page.getByText(/passage 1 of 1/i)).toBeVisible();
}

/**
 * Types the passage one first letter at a time, reading each expected letter
 * from the cursor the exercise displays.
 */
async function typeWholePassage(page: Page) {
  const cursor = page.locator('[aria-live="assertive"]');
  const input = page.getByLabel(/type the first letter of each word/i);

  for (let word = 0; word < 400; word += 1) {
    if ((await cursor.count()) === 0) return;
    const letter = (await cursor.innerText()).trim();
    if (letter === '') return;
    await input.press(letter);
  }

  throw new Error('The passage did not finish within the expected word count');
}

test.describe('completing a first-letter review', () => {
  test('saves the rating, the history and the next due date', async ({ page }) => {
    await startFirstLetterSession(page);

    await expect(page.getByText(/0 of \d+ words/)).toBeVisible();
    await typeWholePassage(page);

    await expect(page.getByText('Passage complete.')).toBeVisible();
    await expect(page.getByText(/how well did you recall it\?/i)).toBeVisible();

    await page.getByRole('button', { name: /^Good/ }).click();

    await expect(page.getByText(/session complete/i)).toBeVisible();

    await page.goto('/verses/verse-001');
    await expect(page.getByText('1 recorded review')).toBeVisible();
    await expect(
      page.getByRole('definition').filter({ hasText: 'Tomorrow' }).first(),
    ).toBeVisible();
    await expect(page.getByText('1 day').first()).toBeVisible();
  });

  test('keeps the due date after a reload', async ({ page }) => {
    await startFirstLetterSession(page);
    await typeWholePassage(page);
    await page.getByRole('button', { name: /^Good/ }).click();
    await expect(page.getByText(/session complete/i)).toBeVisible();

    await page.goto('/verses/verse-001');
    await page.reload();

    await expect(page.getByText('1 recorded review')).toBeVisible();
    await expect(page.getByText('First letter').first()).toBeVisible();
  });

  test('an incorrect letter does not advance the exercise', async ({ page }) => {
    await startFirstLetterSession(page);

    const input = page.getByLabel(/type the first letter of each word/i);
    const cursor = page.locator('[aria-live="assertive"]');
    const expected = (await cursor.innerText()).trim();
    const wrong = expected === 'z' ? 'q' : 'z';

    await input.press(wrong);

    await expect(page.getByText(/0 of \d+ words · 1 wrong keys/)).toBeVisible();
  });

  test('can be paused and resumed', async ({ page }) => {
    await page.goto('/review');
    await page.getByRole('button', { name: 'Passage number range' }).click();
    await page.getByLabel('To passage').fill('3');
    await page.getByRole('button', { name: 'One mode for the session' }).click();
    await page.getByLabel('Mode', { exact: true }).selectOption('flashcard');
    await page.getByRole('button', { name: 'Start session' }).click();

    await expect(page.getByText(/passage 1 of 3/i)).toBeVisible();
    await page.getByRole('button', { name: 'Reveal passage' }).click();
    await page.getByRole('button', { name: /^Good/ }).click();
    await expect(page.getByText(/passage 2 of 3/i)).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Pause and leave' }).click();

    await expect(page.getByText(/you have an unfinished session/i)).toBeVisible();
    await expect(page.getByText(/1 of 3 completed/i)).toBeVisible();

    await page.getByRole('button', { name: 'Resume session' }).click();
    await expect(page.getByText(/passage 2 of 3/i)).toBeVisible();
  });

  test('a difficult-verse session contains only flagged passages', async ({
    page,
  }) => {
    await page.goto('/verses');
    await page
      .getByRole('button', { name: `More actions for ${FIRST_PASSAGE}` })
      .click();
    await page.getByRole('menuitem', { name: 'Mark difficult' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: FIRST_PASSAGE }).getByText('Difficult'),
    ).toBeVisible();

    await page.goto('/review?source=difficult');
    await expect(page.getByText('1 passage in this session')).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: FIRST_PASSAGE }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page.getByText(/passage 1 of 1/i)).toBeVisible();
    await expect(page.getByText(FIRST_PASSAGE).first()).toBeVisible();
  });
});
