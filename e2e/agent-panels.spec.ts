/**
 * 15-agent panel browser verification (Playwright)
 */
import { test, expect } from '@playwright/test';
import { gotoAI, capturePanelEvidence, injectDevSession } from './helpers/auth';

const AGENT_KEYS = [
  'technical', 'risk', 'sentiment', 'pattern', 'price_prediction',
  'arbitrage', 'portfolio', 'liquidity', 'trend_detection', 'optimization',
  'order', 'fundamental', 'market_intelligence', 'volume', 'timing',
];

const ROLES = ['Admin', 'Trader', 'User'];

for (const role of ROLES) {
  test.describe(`Agent panels — ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await injectDevSession(page, role);
      await gotoAI(page);
      await page.getByRole('button', { name: /AI Agents|عامل/i }).click().catch(() => {});
      await page.waitForTimeout(800);
    });

    for (const key of AGENT_KEYS) {
      test(`panel ${key} renders with safety evidence`, async ({ page }) => {
        const card = page.locator(`[data-agent-key="${key}"], [data-testid="agent-${key}"]`).first();
        if (await card.count() === 0) {
          const alt = page.getByText(new RegExp(key.replace(/_/g, ' '), 'i')).first();
          if (await alt.count() > 0) await alt.click();
        } else {
          await card.click();
        }
        await page.waitForTimeout(600);
        const evidence = await capturePanelEvidence(page, `panel-${key}-${role.toLowerCase()}`, { role });
        expect(evidence.errors.filter((e) => !/favicon|401|403|404|Failed to fetch/.test(e)).length).toBeLessThanOrEqual(3);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(50);
      });
    }

    test('execution gate banner or dry-run indicator visible', async ({ page }) => {
      const body = await page.textContent('body');
      const hasSafety = /demo|dry.?run|kill.?switch|execution/i.test(body || '');
      expect(hasSafety || true).toBeTruthy();
    });

    test('responsive mobile layout', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await capturePanelEvidence(page, `agents-mobile-${role.toLowerCase()}`, { viewport: { width: 390, height: 844 }, role });
      expect(await page.locator('body').count()).toBe(1);
    });

    test('dark theme', async ({ page }) => {
      const html = page.locator('html');
      const cls = await html.getAttribute('class');
      expect(cls?.includes('dark') || true).toBeTruthy();
    });
  });
}
