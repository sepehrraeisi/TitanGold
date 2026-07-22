/**
 * PR-safe E2E smoke — no MEXC, no Delete, no live credentials.
 */
import { test, expect } from '@playwright/test';

test.describe('CI smoke', () => {
  test('app shell loads without provider transport', async ({ page }) => {
    const providerHits: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/api\.mexc\.com|mexc\.com\/api/i.test(url)) {
        providerHits.push(url);
      }
    });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    expect(providerHits, 'no MEXC provider requests during CI smoke').toEqual([]);
    const fatal = consoleErrors.filter(
      (e) => /ReferenceError|TypeError:|setConfirmDelete/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal).toEqual([]);
  });

  test('Vite entry HTML is served', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBeLessThan(500);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
  });
});
