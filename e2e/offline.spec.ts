import { expect, test } from '@playwright/test';

test.describe('installable and offline', () => {
  test('ships a usable web app manifest', async ({ page, request }) => {
    await page.goto('/');

    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(href).toBeTruthy();

    const response = await request.get(href as string);
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toContain('Verse Memory');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('registers a service worker', async ({ page }) => {
    await page.goto('/');

    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active ?? registration.installing);
    });
    expect(registered).toBe(true);
  });

  test('keeps working after the network goes away', async ({ page, context }) => {
    await page.goto('/verses');
    const checkbox = page.getByRole('checkbox', {
      name: 'Mark Exodus 19:4-6 as memorized',
    });
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Let the service worker finish precaching before cutting the network.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1000);

    await context.setOffline(true);
    await page.reload();

    await expect(
      page.getByRole('heading', { name: /verse library/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Mark Exodus 19:4-6 as memorized' }),
    ).toBeChecked();

    // The Scripture itself is bundled, so passages are readable offline.
    await page.goto('/flashcards?verse=verse-001');
    await expect(page.getByText(/bore you on eagles/)).toBeVisible();

    await context.setOffline(false);
  });
});
