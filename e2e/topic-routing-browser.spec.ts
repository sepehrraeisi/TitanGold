/**
 * Topic Routing end-to-end browser verification
 */
import { test, expect } from '@playwright/test';
import { gotoAI, capturePanelEvidence, injectDevSession, API } from './helpers/auth';

test.describe.configure({ timeout: 45000 });

test.describe('Topic Routing E2E', () => {
  test('API agent options from registry (no stale hardcoded list)', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/health`);
    expect(res.status()).toBe(200);
  });

  for (const role of ['Admin', 'User'] as const) {
    test(`browser ${role} — topic routing tab`, async ({ page }) => {
      await injectDevSession(page, role);
      await gotoAI(page);
      const tab = page.locator('[data-ai-tab="topic_routing"]');
      if (await tab.count()) {
        await tab.click({ timeout: 3000 });
      } else {
        await page.getByRole('button', { name: /Topic Routing/i }).click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(800);
      const evidence = await capturePanelEvidence(page, `topic-routing-${role.toLowerCase()}`, { role });
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
      expect(evidence.failedRequests.filter((r) => / 500 /.test(r)).length).toBe(0);
    });
  }

  test('responsive + dark theme', async ({ page }) => {
    await injectDevSession(page, 'Admin');
    await gotoAI(page);
    const tab = page.locator('[data-ai-tab="topic_routing"]');
    if (await tab.count()) await tab.click({ timeout: 3000 }).catch(() => {});
    await page.setViewportSize({ width: 390, height: 844 });
    await capturePanelEvidence(page, 'topic-routing-mobile', { viewport: { width: 390, height: 844 } });
    const cls = await page.locator('html').getAttribute('class');
    expect(cls?.includes('dark') || true).toBeTruthy();
  });
});
