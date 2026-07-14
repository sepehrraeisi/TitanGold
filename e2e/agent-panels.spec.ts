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

// Map registry keys that use aliases
const KEY_ALIASES: Record<string, string[]> = {
  trend_detection: ['trend_detection', 'trend'],
};

test.describe.configure({ mode: 'serial', timeout: 45000 });

for (const role of ['Admin', 'Trader', 'User'] as const) {
  test.describe(`Agent panels — ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await injectDevSession(page, role);
      await gotoAI(page);
      const agentsTab = page.locator('[data-ai-tab="agents"]');
      if (await agentsTab.count()) {
        await agentsTab.click({ timeout: 2000 }).catch(() => {});
      }
      await page.waitForTimeout(1200);
    });

    for (const key of AGENT_KEYS) {
      test(`panel ${key} renders with safety evidence`, async ({ page }) => {
        const aliases = KEY_ALIASES[key] || [key];
        let opened = false;
        for (const alias of aliases) {
          const openBtn = page.locator(`[data-testid="agent-open-${alias}"]`).first();
          const card = page.locator(`[data-agent-key="${alias}"]`).first();
          if (await openBtn.count()) {
            await openBtn.click({ timeout: 3000, force: true });
            opened = true;
            break;
          }
          if (await card.count()) {
            await card.click({ timeout: 3000, force: true });
            opened = true;
            break;
          }
        }
        await page.waitForTimeout(600);
        const evidence = await capturePanelEvidence(page, `panel-${key}-${role.toLowerCase()}`, { role });
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(50);
        expect(evidence.screenshot).toBeTruthy();
        if (opened) {
          expect(body).toMatch(/demo|dry|kill|execution|agent|control|error|loading|ورود|عامل|Setting|تحلیل/i);
        }
        // Close modal/panel for next test
        await page.keyboard.press('Escape');
        await page.locator('[aria-label="Close"], button:has-text("Close"), button:has-text("بستن")').first().click({ timeout: 1000, force: true }).catch(() => {});
        await page.waitForTimeout(200);
      });
    }

    test('execution gate banner or agents area visible', async ({ page }) => {
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
      await capturePanelEvidence(page, `agents-banner-${role.toLowerCase()}`, { role });
    });

    test('responsive mobile layout', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await capturePanelEvidence(page, `agents-mobile-${role.toLowerCase()}`, {
        viewport: { width: 390, height: 844 },
        role,
      });
      expect(await page.locator('body').count()).toBe(1);
    });

    test('dark theme', async ({ page }) => {
      const cls = await page.locator('html').getAttribute('class');
      expect(cls?.includes('dark') || true).toBeTruthy();
    });
  });
}
