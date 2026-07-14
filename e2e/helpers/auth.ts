/**
 * Playwright auth helpers — injectable session with optional real JWT fixtures.
 */
const API = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5002';

type RoleName = 'Admin' | 'Trader' | 'User' | 'Vip';

function tokenFor(role: RoleName): string {
  const map: Record<string, string | undefined> = {
    Admin: process.env.PLAYWRIGHT_ADMIN_TOKEN,
    Trader: process.env.PLAYWRIGHT_TRADER_TOKEN,
    User: process.env.PLAYWRIGHT_USER_TOKEN,
    Vip: process.env.PLAYWRIGHT_VIP_TOKEN || process.env.PLAYWRIGHT_USER_TOKEN,
  };
  return map[role] || process.env.PLAYWRIGHT_ADMIN_TOKEN || `dev-token-${role.toLowerCase()}`;
}

export async function injectDevSession(page: import('@playwright/test').Page, role: RoleName = 'Admin') {
  const token = tokenFor(role);
  await page.addInitScript(
    ({ r, t }) => {
      const mockUser = {
        id: `pw-${r.toLowerCase()}`,
        name: `Playwright ${r}`,
        email: `pw-${r.toLowerCase()}@test.local`,
        username: `pw_${r.toLowerCase()}`,
        role: r,
      };
      sessionStorage.setItem('titan_user', JSON.stringify(mockUser));
      localStorage.setItem('titan_user', JSON.stringify(mockUser));
      sessionStorage.setItem('titan_token', t);
      localStorage.setItem('titan_token', t);
    },
    { r: role, t: token },
  );
}

export async function gotoAI(page: import('@playwright/test').Page) {
  await page.goto('/?view=ai&dev-login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
}

export async function gotoAIManager(page: import('@playwright/test').Page) {
  await gotoAI(page);
  const manager = page.locator('[data-ai-tab="manager"]');
  if (await manager.count()) {
    await manager.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
  }
}

export async function capturePanelEvidence(
  page: import('@playwright/test').Page,
  name: string,
  opts: { viewport?: { width: number; height: number }; role?: string } = {},
) {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()}`));
  if (opts.viewport) await page.setViewportSize(opts.viewport);
  await page.waitForTimeout(400);
  const screenshot = `e2e/screenshots/${name}.png`;
  await page.screenshot({ path: screenshot, fullPage: true, timeout: 10000 });
  return {
    screenshot,
    errors,
    failedRequests,
    viewport: opts.viewport || { width: 1280, height: 720 },
    role: opts.role || 'admin',
  };
}

export { API };
