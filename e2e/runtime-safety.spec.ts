/**
 * Runtime safety browser QA — staging/local
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/runtime-safety.spec.ts
 */
import { test, expect } from '@playwright/test';

const API = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5002';

test.describe('Runtime Safety UI', () => {
  test('login page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: 'e2e/screenshots/runtime-safety-home.png', fullPage: true });
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('health API reachable from browser context', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('execution-runtime rejects unauthenticated requests', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/settings/execution-runtime`);
    expect(res.status()).toBe(401);
  });
});
