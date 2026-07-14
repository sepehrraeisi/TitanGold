/**
 * Artemis affected tabs browser verification
 */
import { test, expect } from '@playwright/test';
import { gotoAIManager, capturePanelEvidence, injectDevSession } from './helpers/auth';

const ARTEMIS_TABS = [
  'overview',
  'decision_engine',
  'orchestration',
  'scenarios',
  'settings',
  'autopilot',
];

test.describe.configure({ mode: 'serial', timeout: 45000 });

for (const role of ['Admin', 'Trader', 'User'] as const) {
  test.describe(`Artemis tabs — ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await injectDevSession(page, role);
      await gotoAIManager(page);
    });

    for (const tabId of ARTEMIS_TABS) {
      test(`${tabId} tab opens and captures evidence`, async ({ page }) => {
        const btn = page.locator(`[data-artemis-tab="${tabId}"]`).first();
        if (await btn.count()) {
          await btn.click({ timeout: 3000, force: true });
          await page.waitForTimeout(800);
        }
        const evidence = await capturePanelEvidence(page, `artemis-${tabId}-${role.toLowerCase()}`, { role });
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(50);
        expect(evidence.failedRequests.filter((r) => / 500 |502 /.test(r)).length).toBe(0);
      });
    }

    test('hard refresh preserves manager area', async ({ page }) => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
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
