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
    const marker = '__titan_e2e_auth_cleared__';
    if (sessionStorage.getItem(marker)) return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(marker, '1');
  });
}

async function waitForLoginForm(page: import('@playwright/test').Page) {
  await expect(page.locator('#username')).toBeVisible({ timeout: 20000 });
}

async function submitLogin(page: import('@playwright/test').Page, username: string, password: string) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /login|ورود/i }).click();
}

async function submitLoginAndAwaitResponse(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
) {
  await waitForLoginForm(page);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') &&
      response.request().method() === 'POST',
    { timeout: 45000 },
  );
  await submitLogin(page, username, password);
  return responsePromise;
}

async function expectAuthenticatedLanding(page: import('@playwright/test').Page) {
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('titan_token')), {
      timeout: 20000,
    })
    .not.toBeNull();
  await expect(page.locator('#username')).toHaveCount(0, { timeout: 20000 });
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

    const loginResponse = await submitLoginAndAwaitResponse(page, loginUser!, loginPassword!);
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.token).toEqual(expect.any(String));

    await expectAuthenticatedLanding(page);

    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeTruthy();
    expect(token).not.toMatch(/^dev-token-/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectAuthenticatedLanding(page);

    const fatal = consoleErrors.filter(
      (e) => /CORS|Not allowed by CORS|500/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal).toEqual([]);
  });

  test('logout and re-login cycle clears and restores authenticated session', async ({ page, context }) => {
    await clearAuthState(page, context);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const firstLogin = await submitLoginAndAwaitResponse(page, loginUser!, loginPassword!);
    expect(firstLogin.status()).toBe(200);
    await expectAuthenticatedLanding(page);

    await page.evaluate(() => {
      localStorage.removeItem('titan_token');
      localStorage.removeItem('titan_user');
      sessionStorage.removeItem('titan_token');
      sessionStorage.removeItem('titan_user');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForLoginForm(page);

    const secondLogin = await submitLoginAndAwaitResponse(page, loginUser!, loginPassword!);
    expect(secondLogin.status()).toBe(200);
    await expectAuthenticatedLanding(page);

    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeTruthy();
  });

  test('wrong password shows safe generic error', async ({ page, context, request }) => {
    await clearAuthState(page, context);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loginResponse = await submitLoginAndAwaitResponse(
      page,
      loginUser!,
      '__definitely_wrong_password__',
    );
    expect(loginResponse.status()).toBe(401);

    await expect(page.locator('body')).toContainText(/invalid username or password|invalid_credentials|نام کاربری یا رمز/i);
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
