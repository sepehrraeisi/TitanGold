/**
 * Non-destructive Arbitrage read-only browser smoke (Staging).
 */
import { test, expect, type Page } from '@playwright/test';
import { performRealLogin, runLoginE2e } from './helpers/loginFixture';

const ARB_TABS = ['overview', 'candidates', 'history', 'profitRisk', 'settings', 'integration'] as const;

type SmokeMetrics = {
  consoleErrors: string[];
  pageErrors: string[];
  scanPosts: number;
  settingsPosts: number;
  monitoringMutations: number;
};

function isProductConsoleError(text: string) {
  // Public market-data fetch noise in headless Staging — not auth/private/financial side effects.
  if (/Failed to fetch MEXC 24hr ticker/i.test(text)) return false;
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
    if (/\/arbitrage\/scan/.test(url)) metrics.scanPosts += 1;
    if (/\/arbitrage\/settings/.test(url)) metrics.settingsPosts += 1;
    if (/\/monitoring\/(pause|resume)/.test(url)) metrics.monitoringMutations += 1;
  });
}

async function openAgentsArbitrage(page: Page) {
  await page.goto('/?view=ai', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.locator('[data-ai-tab="agents"]').first().click({ timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[data-agent-key="arbitrage"]', { timeout: 45_000 });
  await page.locator('[data-testid="agent-open-arbitrage"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="arb-workspace"], [data-testid="agent-product-dialog"]', {
    timeout: 45_000,
  });
}

async function stubReadOnlyStatusRoutes(page: Page) {
  await page.route('**/api/v1/settings/execution-runtime**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        effectiveMode: 'demo',
        killSwitchActive: true,
        workerAcknowledged: true,
      }),
    }),
  );
  await page.route('**/api/v1/trading-engine/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', mode: 'demo' }),
    }),
  );
}

async function runReadOnlyArbitrageFlow(page: Page, locale: 'en' | 'fa', dir: 'ltr' | 'rtl') {
  await page.route('**/api.mexc.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.addInitScript(({ localeValue, dirValue }) => {
    localStorage.setItem('titan_language', localeValue);
    localStorage.setItem('titan_migration_dismissed', 'true');
    const apply = () => {
      if (document.documentElement) {
        document.documentElement.dir = dirValue;
        document.documentElement.lang = localeValue === 'fa' ? 'fa' : 'en';
      }
    };
    apply();
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }, { localeValue: locale, dirValue: dir });

  await openAgentsArbitrage(page);

  for (const tab of ARB_TABS) {
    await page.getByTestId(`arb-tab-${tab}`).click({ timeout: 15_000 });
    await expect(page.getByTestId('arb-tab-panel')).toBeVisible({ timeout: 15_000 });
  }

  const scanBtn = page.locator('[data-testid="agent-product-dialog"] [data-testid="arb-run-analytical-scan"]');
  if (await scanBtn.count()) {
    await scanBtn.click({ timeout: 10_000 }).catch(() => {});
    const cancel = page.getByTestId('arb-scan-confirm-cancel');
    if (await cancel.count()) {
      await cancel.click({ timeout: 5_000 });
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('[data-testid="agent-product-confirmation-backdrop"]')).toHaveCount(0, {
      timeout: 5_000,
    });
  }

  const candRow = page.locator('[data-testid^="arb-candidate-row-"]').first();
  if (await candRow.count()) {
    await candRow.click({ timeout: 5_000 }).catch(() => {});
    await page.keyboard.press('Escape');
  }

  const historyRow = page.locator('[data-testid^="arb-history-row-"]').first();
  if (await historyRow.count()) {
    await historyRow.click({ timeout: 5_000 }).catch(() => {});
    await page.keyboard.press('Escape');
  }

  await page.goto('/?view=ai&agentSection=overview', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await page.goForward({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});

  const refreshUrl = page.url();
  await page.goto(refreshUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('#username')).toHaveCount(0, { timeout: 20_000 });

  await page.keyboard.press('Escape');
  await page.locator('[aria-label="Close"], button:has-text("Close"), button:has-text("بستن")')
    .first()
    .click({ timeout: 2_000, force: true })
    .catch(() => {});

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/agents\.|arb\.[a-z_]+\./i);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);

  const orphans = await page.locator('[data-testid="agent-product-confirmation-backdrop"]').count();
  expect(orphans).toBe(0);
}

test.describe('Arbitrage read-only smoke', () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!runLoginE2e, 'requires RUN_LOGIN_E2E=1 and disposable fixture env');

  test('EN desktop read-only matrix', async ({ page, context }) => {
    const metrics: SmokeMetrics = {
      consoleErrors: [],
      pageErrors: [],
      scanPosts: 0,
      settingsPosts: 0,
      monitoringMutations: 0,
    };
    attachMetrics(page, metrics);

    await stubReadOnlyStatusRoutes(page);
    await performRealLogin(page, context);
    await runReadOnlyArbitrageFlow(page, 'en', 'ltr');

    expect(metrics.scanPosts).toBe(0);
    expect(metrics.settingsPosts).toBe(0);
    expect(metrics.monitoringMutations).toBe(0);
    expect(metrics.consoleErrors).toEqual([]);
    expect(metrics.pageErrors).toEqual([]);
  });

  test('FA desktop read-only matrix', async ({ page, context }) => {
    const metrics: SmokeMetrics = {
      consoleErrors: [],
      pageErrors: [],
      scanPosts: 0,
      settingsPosts: 0,
      monitoringMutations: 0,
    };
    attachMetrics(page, metrics);

    await stubReadOnlyStatusRoutes(page);
    await performRealLogin(page, context);
    await runReadOnlyArbitrageFlow(page, 'fa', 'rtl');

    expect(metrics.scanPosts).toBe(0);
    expect(metrics.settingsPosts).toBe(0);
    expect(metrics.monitoringMutations).toBe(0);
    expect(metrics.consoleErrors).toEqual([]);
    expect(metrics.pageErrors).toEqual([]);
  });

  test('mobile portrait read-only matrix', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const metrics: SmokeMetrics = {
      consoleErrors: [],
      pageErrors: [],
      scanPosts: 0,
      settingsPosts: 0,
      monitoringMutations: 0,
    };
    attachMetrics(page, metrics);

    await stubReadOnlyStatusRoutes(page);
    await performRealLogin(page, context);
    await runReadOnlyArbitrageFlow(page, 'en', 'ltr');

    expect(metrics.scanPosts).toBe(0);
    expect(metrics.settingsPosts).toBe(0);
    expect(metrics.monitoringMutations).toBe(0);
    expect(metrics.consoleErrors).toEqual([]);
    expect(metrics.pageErrors).toEqual([]);
  });
});
