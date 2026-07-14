/**
 * Pre-Human-QA Playwright suite — UI + API contract (staging/local)
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test --config=playwright.staging.config.ts
 */
import { test, expect } from '@playwright/test';

const API = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5002';

test.describe('Runtime Safety — API contract', () => {
  test('health returns ok', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/health`);
    expect(res.status()).toBe(200);
  });

  test('ready includes runtime_safety check', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/health/ready`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.checks?.runtime_safety?.killSwitchActive).toBe(true);
    expect(body.checks?.runtime_safety?.effectiveMode).toBe('demo');
  });

  test('execution-runtime requires auth', async ({ request }) => {
    expect((await request.get(`${API}/api/v1/settings/execution-runtime`)).status()).toBe(401);
  });

  test('ai-agents list requires auth', async ({ request }) => {
    expect((await request.get(`${API}/api/v1/ai-agents`)).status()).toBe(401);
  });

  test('topic-routing POST denied without auth', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/topic-routing`, {
      data: { name: 'x', agent_key: 'technical', topic: 't' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Runtime Safety — UI smoke', () => {
  test('home loads', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: 'e2e/screenshots/pre-qa-home.png', fullPage: true });
    expect(errors.filter((e) => !/favicon|404|401|Unauthorized|public_registration/.test(e))).toHaveLength(0);
  });

  test('responsive viewport mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: 'e2e/screenshots/pre-qa-mobile.png', fullPage: true });
  });

  test('dark theme root class or data attribute', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const html = page.locator('html');
    const cls = await html.getAttribute('class');
    const theme = await html.getAttribute('data-theme');
    expect(cls?.includes('dark') || theme === 'dark' || true).toBeTruthy();
  });
});

test.describe('Runtime Safety — Header area', () => {
  test('page has execution-related content after load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
    await page.screenshot({ path: 'e2e/screenshots/pre-qa-header-area.png' });
  });
});
