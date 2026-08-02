import { expect, type Page, type BrowserContext } from '@playwright/test';

export const loginUser = process.env.PLAYWRIGHT_LOGIN_USER;
export const loginPassword = process.env.PLAYWRIGHT_LOGIN_PASSWORD;
export const runLoginE2e = process.env.RUN_LOGIN_E2E === '1';

export function requireLoginFixture() {
  if (!runLoginE2e || !loginUser || !loginPassword) {
    throw new Error('requires RUN_LOGIN_E2E=1 and disposable fixture env');
  }
}

export async function clearAuthState(page: Page, context: BrowserContext) {
  await context.clearCookies();
  await page.addInitScript(() => {
    const marker = '__titan_e2e_auth_cleared__';
    if (sessionStorage.getItem(marker)) return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(marker, '1');
  });
}

export async function waitForLoginForm(page: Page) {
  await expect(page.locator('#username')).toBeVisible({ timeout: 20_000 });
}

export async function submitLogin(page: Page, username: string, password: string) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /login|ورود/i }).click();
}

export async function submitLoginAndAwaitResponse(page: Page, username: string, password: string) {
  await waitForLoginForm(page);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') &&
      response.request().method() === 'POST',
    { timeout: 45_000 },
  );
  await submitLogin(page, username, password);
  return responsePromise;
}

export async function expectAuthenticatedLanding(page: Page) {
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('titan_token')), {
      timeout: 20_000,
    })
    .not.toBeNull();
  await expect(page.locator('#username')).toHaveCount(0, { timeout: 20_000 });
}

export async function performRealLogin(page: Page, context: BrowserContext) {
  requireLoginFixture();
  await clearAuthState(page, context);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const loginResponse = await submitLoginAndAwaitResponse(page, loginUser!, loginPassword!);
  expect(loginResponse.status()).toBe(200);
  await expectAuthenticatedLanding(page);
}

export function stagingOrigin(baseURL: string) {
  try {
    return new URL(baseURL).origin;
  } catch {
    return 'https://titan.zala.ir';
  }
}
