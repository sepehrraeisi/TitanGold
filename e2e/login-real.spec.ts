/**
 * Real login form E2E — disposable user, no injected session token.
 *
 * Run with isolated backend + disposable DB:
 *   RUN_LOGIN_E2E=1 PLAYWRIGHT_LOGIN_USER=... PLAYWRIGHT_LOGIN_PASSWORD=... npm run test:e2e -- e2e/login-real.spec.ts
 */
import { test, expect } from '@playwright/test';

const loginUser = process.env.PLAYWRIGHT_LOGIN_USER;
const loginPassword = process.env.PLAYWRIGHT_LOGIN_PASSWORD;
const runLoginE2e = process.env.RUN_LOGIN_E2E === '1';

test.describe('Real username/password login', () => {
  test.skip(!runLoginE2e || !loginUser || !loginPassword, 'requires RUN_LOGIN_E2E=1 and disposable fixture env');

  test('login form authenticates without pre-injected token', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByLabel(/username|email|نام کاربری/i).fill(loginUser!);
    await page.getByLabel(/password|رمز/i).fill(loginPassword!);
    await page.getByRole('button', { name: /login|ورود/i }).click();

    await expect(page.locator('body')).not.toContainText(/invalid username or password/i, {
      timeout: 15000,
    });

    await page.waitForTimeout(1500);
    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText(/invalid username or password/i);

    const fatal = consoleErrors.filter(
      (e) => /CORS|Not allowed by CORS|500/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal).toEqual([]);
  });

  test('wrong password shows safe generic error', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/');
    await page.getByLabel(/username|email|نام کاربری/i).fill(loginUser!);
    await page.getByLabel(/password|رمز/i).fill('__definitely_wrong_password__');
    await page.getByRole('button', { name: /login|ورود/i }).click();

    await expect(page.locator('body')).toContainText(/invalid username or password|نام کاربری یا رمز/i);
    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeFalsy();
  });
});
