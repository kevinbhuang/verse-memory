import { expect, test, type Page } from '@playwright/test';

const FIRST_PASSAGE = 'Exodus 19:4-6';

/**
 * Starts a one-passage first-letter session from the library row action.
 */
async function startFirstLetterSession(page: Page) {
  await page.goto('/verses');
  await page
    .getByRole('button', { name: `Practice ${FIRST_PASSAGE} with first letters` })
    .click();

  await expect(page.getByText(/passage 1 of 1/i)).toBeVisible();
  await expect(page.getByText(FIRST_PASSAGE).first()).toBeVisible();
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
    await page.goto('/practice');
    await page.getByRole('button', { name: /deck 1/i }).click();
    await page
      .getByRole('button', { name: /type the first letter of each word/i })
      .click();
    await expect(page.getByText(/passages/i).first()).toBeVisible();
    await page.getByRole('button', { name: /^start$/i }).click();

    await expect(page.getByText(/passage 1 of/i)).toBeVisible();
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page.getByText(/passage 2 of/i)).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Pause and leave' }).click();

    await expect(page.getByText(/you have an unfinished session/i)).toBeVisible();
    await expect(page.getByText(/1 of \d+ completed/i)).toBeVisible();

    await page.getByRole('button', { name: /^resume$/i }).click();
    await expect(page.getByText(/passage 2 of/i)).toBeVisible();
  });

  test('a deck session stays inside that section', async ({ page }) => {
    await page.goto('/practice?section=Acts');
    await expect(page.getByRole('button', { name: /deck 5/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/4 passage/i)).toBeVisible();

    await page
      .getByRole('button', { name: /type the first letter of each word/i })
      .click();
    await page.getByRole('button', { name: /^start$/i }).click();
    await expect(page.getByText(/passage 1 of 4/i)).toBeVisible();
  });
});
