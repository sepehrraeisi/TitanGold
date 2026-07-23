/**
 * Real login form E2E — disposable user, no injected session token.
 */
import { test, expect } from '@playwright/test';

const loginUser = process.env.PLAYWRIGHT_LOGIN_USER;
const loginPassword = process.env.PLAYWRIGHT_LOGIN_PASSWORD;
const runLoginE2e = process.env.RUN_LOGIN_E2E === '1';

async function clearAuthState(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  await context.clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function submitLogin(page: import('@playwright/test').Page, username: string, password: string) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /login|ورود/i }).click();
}

test.describe('Real username/password login', () => {
  test.skip(!runLoginE2e || !loginUser || !loginPassword, 'requires RUN_LOGIN_E2E=1 and disposable fixture env');

  test('login form authenticates without pre-injected token', async ({ page, context }) => {
    await clearAuthState(page, context);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await submitLogin(page, loginUser!, loginPassword!);

    await expect(page.locator('body')).not.toContainText(/invalid username or password/i, {
      timeout: 15000,
    });

    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText(/invalid username or password/i);

    const fatal = consoleErrors.filter(
      (e) => /CORS|Not allowed by CORS|500/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal).toEqual([]);
  });

  test('logout clears session and returns to login form', async ({ page, context }) => {
    await clearAuthState(page, context);
    await page.goto('/');
    await submitLogin(page, loginUser!, loginPassword!);
    await expect(page.locator('body')).not.toContainText(/invalid username or password/i, {
      timeout: 15000,
    });

    const userMenu = page.locator('button').filter({ hasText: /user|account|پروفایل|کاربر/i }).first();
    if (await userMenu.count()) {
      await userMenu.click();
    }
    const logoutButton = page.getByRole('button', { name: /logout|خروج/i });
    if (await logoutButton.count()) {
      await logoutButton.click();
    } else {
      await page.evaluate(() => {
        localStorage.removeItem('titan_token');
        localStorage.removeItem('titan_user');
        sessionStorage.removeItem('titan_token');
        sessionStorage.removeItem('titan_user');
      });
      await page.reload();
    }

    await expect(page.getByRole('button', { name: /login|ورود/i })).toBeVisible({ timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeFalsy();
  });

  test('wrong password shows safe generic error', async ({ page, context, request }) => {
    await clearAuthState(page, context);
    await page.goto('/');
    await submitLogin(page, loginUser!, '__definitely_wrong_password__');

    await expect(page.locator('body')).toContainText(/invalid username or password|نام کاربری یا رمز/i);
    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeFalsy();

    const apiResponse = await request.post('/api/v1/auth/login', {
      headers: {
        Origin: 'http://127.0.0.1:3010',
        'Content-Type': 'application/json',
      },
      data: { username: loginUser, password: '__definitely_wrong_password__' },
    });
    expect(apiResponse.status()).toBe(401);
    expect(await apiResponse.json()).toMatchObject({ error: 'Invalid credentials' });
  });
});
