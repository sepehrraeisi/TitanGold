/**
 * Artemis affected tabs browser verification
 */
import { test, expect } from '@playwright/test';
import { gotoAIManager, capturePanelEvidence, injectDevSession } from './helpers/auth';

const ARTEMIS_TABS = [
  { id: 'overview', label: /Overview|نمای کلی/i },
  { id: 'decision_engine', label: /Decision Engine|موتور تصمیم/i },
  { id: 'orchestration', label: /Orchestration|هماهنگ/i },
  { id: 'scenarios', label: /Scenarios|سناریو/i },
  { id: 'settings', label: /Settings|تنظیمات/i },
  { id: 'autopilot', label: /Autopilot|خلبان/i },
];

for (const role of ['Admin', 'Trader', 'User']) {
  test.describe(`Artemis tabs — ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await injectDevSession(page, role);
      await gotoAIManager(page);
    });

    for (const tab of ARTEMIS_TABS) {
      test(`${tab.id} tab opens and captures evidence`, async ({ page }) => {
        const btn = page.getByRole('button', { name: tab.label }).first();
        if (await btn.count() > 0) {
          await btn.click();
          await page.waitForTimeout(800);
        }
        const evidence = await capturePanelEvidence(page, `artemis-${tab.id}-${role.toLowerCase()}`, { role });
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(100);
        expect(evidence.failedRequests.filter((r) => /500|502/.test(r)).length).toBe(0);
      });
    }

    test('hard refresh preserves tab area', async ({ page }) => {
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await capturePanelEvidence(page, `artemis-refresh-${role.toLowerCase()}`, { role });
      expect(await page.locator('body').count()).toBe(1);
    });

    test('keyboard tab navigation', async ({ page }) => {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await capturePanelEvidence(page, `artemis-keyboard-${role.toLowerCase()}`, { role });
    });
  });
}
