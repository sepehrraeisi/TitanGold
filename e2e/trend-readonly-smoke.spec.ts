/**
 * Non-destructive Trend Detection read-only browser smoke (Staging).
 */
import { test, expect, type Page } from '@playwright/test';
import { performRealLogin } from './helpers/loginFixture';

const TREND_TABS = [
  'overview',
  'regimeStrength',
  'evidence',
  'weakeningReversal',
  'multiTimeframe',
  'history',
  'settings',
  'integration',
] as const;

type SmokeMetrics = {
  consoleErrors: string[];
  pageErrors: string[];
  analyzePosts: number;
  settingsPosts: number;
  monitoringMutations: number;
  privateProviderPosts: number;
};

function isProductConsoleError(text: string) {
  if (/Failed to fetch MEXC/i.test(text)) return false;
  if (/favicon\.ico/i.test(text)) return false;
  return true;
}

function attachMetrics(page: Page, metrics: SmokeMetrics) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' && isProductConsoleError(msg.text())) {
      metrics.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => metrics.pageErrors.push(String(err)));
  page.on('request', (req) => {
    if (req.method() !== 'POST') return;
    const url = req.url();
    if (/\/trend\/analyze/.test(url)) metrics.analyzePosts += 1;
    if (/\/trend\/settings/.test(url)) metrics.settingsPosts += 1;
    if (/\/monitoring\/(pause|resume)/.test(url)) metrics.monitoringMutations += 1;
    if (/\/api\/v3\/(order|account|capital)/.test(url)) metrics.privateProviderPosts += 1;
  });
}

async function openAgentsTrend(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('titan_migration_dismissed', 'true');
  });
  await page.goto('/?view=ai', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.locator('[data-ai-tab="agents"]').first().click({ timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[data-agent-key="trend_detection"], [data-agent-key="trend"]', { timeout: 45_000 });
  await page.getByTestId('agent-open-trend').click({ force: true, timeout: 15_000 });
  await page.waitForSelector('[data-testid="trend-workspace"], [data-testid="agent-product-dialog"]', {
    timeout: 45_000,
  });
}

test.describe('Trend Detection read-only smoke', () => {
  test('login + sections EN', async ({ page, context }) => {
    const metrics: SmokeMetrics = {
      consoleErrors: [],
      pageErrors: [],
      analyzePosts: 0,
      settingsPosts: 0,
      monitoringMutations: 0,
      privateProviderPosts: 0,
    };
    attachMetrics(page, metrics);
    await performRealLogin(page, context);
    await openAgentsTrend(page);

    for (const tab of TREND_TABS) {
      await page.getByTestId(`trend-tab-${tab}`).click({ timeout: 15_000 });
      await expect(page.getByTestId('agent-product-dialog')).toBeVisible({ timeout: 15_000 });
    }

    const runBtn = page.getByTestId('trend-run-analytical-analysis');
    await runBtn.click();
    await expect(page.getByTestId('trend-analyze-confirm-run')).toBeVisible();
    await page.getByTestId('trend-analyze-confirm-cancel').click();

    expect(metrics.analyzePosts).toBe(0);
    expect(metrics.monitoringMutations).toBe(0);
    expect(metrics.privateProviderPosts).toBe(0);
    expect(metrics.pageErrors).toEqual([]);
  });
});
