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
  test('saves the practice attempt and history', async ({ page }) => {
    await startFirstLetterSession(page);

    await expect(page.getByText(/0 of \d+ words/)).toBeVisible();
    await typeWholePassage(page);

    await expect(page.getByText('Passage complete.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^finish$/i })).toBeVisible();

    await page.getByRole('button', { name: /^finish$/i }).click();

    await expect(page.getByText(/session complete/i)).toBeVisible();

    await page.goto('/flashcards?verse=verse-001');
    await expect(page.getByRole('heading', { name: /exodus 19:4-6/i })).toBeVisible();
  });

  test('keeps the passage after a reload', async ({ page }) => {
    await startFirstLetterSession(page);
    await typeWholePassage(page);
    await page.getByRole('button', { name: /^finish$/i }).click();
    await expect(page.getByText(/session complete/i)).toBeVisible();

    await page.goto('/flashcards?verse=verse-001');
    await page.reload();

    await expect(page.getByRole('heading', { name: /exodus 19:4-6/i })).toBeVisible();
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

  test('discards a session when leaving mid-way', async ({ page }) => {
    await page.goto('/quiz');
    await page.getByRole('button', { name: /deck 1/i }).click();
    await page
      .getByRole('button', {
        name: /first letters.*first letter of each word/i,
      })
      .click();
    await page.getByRole('button', { name: /all \d+ passages/i }).click();
    await page.getByRole('button', { name: /start quiz/i }).click();

    await expect(page.getByText(/question 1 of/i)).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('heading', { level: 2, name: /^quiz$/i })).toBeVisible();
  });

  test('a deck quiz stays inside that section', async ({ page }) => {
    await page.goto('/quiz');
    await page.getByRole('button', { name: /deck 5/i }).click();
    // Deselect default deck 1 if still selected.
    const deck1 = page.getByRole('button', { name: /deck 1/i });
    if ((await deck1.getAttribute('aria-pressed')) === 'true') {
      await deck1.click();
    }
    await expect(page.getByRole('button', { name: /deck 5/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page
      .getByRole('button', {
        name: /first letters.*first letter of each word/i,
      })
      .click();
    await page.getByRole('button', { name: /all \d+ passages/i }).click();
    await page.getByRole('button', { name: /start quiz/i }).click();
    await expect(page.getByText(/question 1 of 4/i)).toBeVisible();
  });
});
