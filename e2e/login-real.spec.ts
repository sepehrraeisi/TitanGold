/**
 * Real login form E2E — disposable user, no injected session token.
 */
import { test, expect } from '@playwright/test';
import {
  clearAuthState,
  expectAuthenticatedLanding,
  loginPassword,
  loginUser,
  performRealLogin,
  runLoginE2e,
  stagingOrigin,
  submitLoginAndAwaitResponse,
  waitForLoginForm,
} from './helpers/loginFixture';

test.describe('Real username/password login', () => {
  test.skip(!runLoginE2e || !loginUser || !loginPassword, 'requires RUN_LOGIN_E2E=1 and disposable fixture env');

  test('login form authenticates without pre-injected token', async ({ page, context }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await performRealLogin(page, context);

    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeTruthy();
    expect(token).not.toMatch(/^dev-token-/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectAuthenticatedLanding(page);

    const loginConsoleErrors = consoleErrors.filter(
      (e) =>
        /CORS|Not allowed by CORS/i.test(e) &&
        /auth\/login|login/i.test(e) &&
        !/favicon/i.test(e),
    );
    expect(loginConsoleErrors).toEqual([]);
  });

  test('logout and re-login cycle clears and restores authenticated session', async ({ page, context }) => {
    await performRealLogin(page, context);

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

  test('wrong password shows safe generic error', async ({ page, context, request, baseURL }) => {
    await clearAuthState(page, context);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loginResponse = await submitLoginAndAwaitResponse(
      page,
      loginUser!,
      '__definitely_wrong_password__',
    );
    expect(loginResponse.status()).toBe(401);

    const loginBody = await loginResponse.json();
    expect(loginBody).toMatchObject({ error: 'Invalid credentials' });
    expect(JSON.stringify(loginBody)).not.toMatch(/password|hash|token/i);

    const loginError = page.locator('form p.text-red-400, [data-testid="login-error"]');
    await expect(loginError).toBeVisible({ timeout: 10_000 });
    await expect(loginError).toHaveText(/Invalid username or password|نام کاربری یا رمز/i);

    const token = await page.evaluate(() => localStorage.getItem('titan_token'));
    expect(token).toBeFalsy();

    const origin = stagingOrigin(baseURL ?? '');
    const apiResponse = await request.post('/api/v1/auth/login', {
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
      },
      data: { username: loginUser, password: '__definitely_wrong_password__' },
    });
    expect(apiResponse.status()).toBe(401);
    expect(await apiResponse.json()).toMatchObject({ error: 'Invalid credentials' });
  });
});
