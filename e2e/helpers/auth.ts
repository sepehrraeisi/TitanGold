/**
 * Playwright auth helpers — uses backend JWT fixtures when available.
 */
import { request as playwrightRequest } from '@playwright/test';

const API = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5002';

export async function getFixtureToken(role: string): Promise<string | null> {
  const envKey = `PLAYWRIGHT_${role.toUpperCase()}_TOKEN`;
  if (process.env[envKey]) return process.env[envKey]!;
  return null;
}

export async function injectDevSession(page: import('@playwright/test').Page, role = 'Admin') {
  await page.addInitScript((r) => {
    const mockUser = {
      id: `pw-${r.toLowerCase()}`,
      name: `Playwright ${r}`,
      email: `pw-${r.toLowerCase()}@test.local`,
      username: `pw_${r.toLowerCase()}`,
      role: r,
    };
    sessionStorage.setItem('titan_user', JSON.stringify(mockUser));
    localStorage.setItem('titan_user', JSON.stringify(mockUser));
  }, role);
}

export async function gotoAI(page: import('@playwright/test').Page) {
  await page.goto('/?view=ai&dev-login');
  await page.waitForLoadState('domcontentloaded');
}

export async function gotoAIManager(page: import('@playwright/test').Page) {
  await gotoAI(page);
  await page.getByRole('button', { name: /AI Manager|مدیر/i }).click();
  await page.waitForTimeout(500);
}

export async function capturePanelEvidence(
  page: import('@playwright/test').Page,
  name: string,
  opts: { viewport?: { width: number; height: number }; role?: string } = {},
) {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()}`));
  if (opts.viewport) await page.setViewportSize(opts.viewport);
  await page.waitForLoadState('networkidle').catch(() => {});
  const screenshot = `e2e/screenshots/${name}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  return { screenshot, errors, failedRequests, viewport: opts.viewport || { width: 1280, height: 720 }, role: opts.role || 'admin' };
}

export { API };
