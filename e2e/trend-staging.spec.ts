/**
 * Trend Detection Staging verification — read-only, analysis, settings.
 */
import { test, expect, type Page } from '@playwright/test';
import { performRealLogin } from './helpers/loginFixture';

test.use({ trace: 'on', video: 'on' });
test.describe.configure({ mode: 'serial', retries: 0 });

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

type Ledger = {
  consoleErrors: string[];
  pageErrors: string[];
  analyzePosts: string[];
  settingsPatches: string[];
  settingsGets: number;
  monitoringMutations: number;
  privateProviderPosts: number;
  dialogEvents: string[];
};

function attachLedger(page: Page, ledger: Ledger) {
  page.on('dialog', (dialog) => {
    ledger.dialogEvents.push(`${dialog.type()}:${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to fetch MEXC|favicon\.ico|404.*\.map|status of 429/i.test(text)) return;
    ledger.consoleErrors.push(text);
  });
  page.on('pageerror', (err) => ledger.pageErrors.push(String(err)));
  page.on('request', (req) => {
    const url = req.url();
    const method = req.method();
    if (method === 'GET' && /\/trend\/settings/.test(url)) ledger.settingsGets += 1;
    if (method !== 'POST' && method !== 'PATCH') return;
    if (/\/trend\/analyze/.test(url)) ledger.analyzePosts.push(url);
    if (method === 'PATCH' && /\/trend\/settings/.test(url)) ledger.settingsPatches.push(url);
    if (/\/monitoring\/(pause|resume)/.test(url)) ledger.monitoringMutations += 1;
    if (/\/api\/v3\/(order|account|capital)/.test(url)) ledger.privateProviderPosts += 1;
  });
}

async function dismissMigrationIfPresent(page: Page) {
  const skip = page.getByRole('button', { name: /^skip$/i });
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click();
  }
}

async function openTrendWorkspace(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('titan_migration_dismissed', 'true');
  });
  await page.goto('/?view=ai', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await dismissMigrationIfPresent(page);
  await page.locator('[data-ai-tab="agents"]').first().click({ timeout: 15_000 });
  await expect(page.getByTestId('agents-grid')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('agent-card-trend')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('agent-open-trend').click();
  await expect(page.getByTestId('trend-workspace')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function waitTrendOverviewReady(page: Page) {
  await expect
    .poll(
      async () => {
        const loading = await page.getByTestId('trend-overview-loading').count();
        const empty = await page.getByTestId('trend-overview-empty').count();
        const panel = await page.getByTestId('trend-tab-panel').count();
        const error = await page.getByTestId('trend-overview-error').count();
        return loading === 0 && (empty + panel + error) > 0;
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

test('Scenario A — EN desktop read-only sections + cancel confirm', async ({ page, context }) => {
  const ledger: Ledger = {
    consoleErrors: [],
    pageErrors: [],
    analyzePosts: [],
    settingsPatches: [],
    settingsGets: 0,
    monitoringMutations: 0,
    privateProviderPosts: 0,
    dialogEvents: [],
  };
  attachLedger(page, ledger);

  await performRealLogin(page, context);
  await openTrendWorkspace(page);
  await waitTrendOverviewReady(page);

  for (const tab of TREND_TABS) {
    await test.step(`section ${tab}`, async () => {
      const tabBtn = page.getByTestId(`trend-tab-${tab}`);
      await tabBtn.scrollIntoViewIfNeeded();
      await tabBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('trend-workspace')).toBeVisible({ timeout: 15_000 });
      if (tab === 'overview') await waitTrendOverviewReady(page);
    });
  }

  const runBtn = page.getByTestId('trend-run-analytical-analysis');
  await expect(runBtn).toBeEnabled({ timeout: 15_000 });
  await runBtn.click();
  await expect(page.getByTestId('trend-analyze-confirm-run')).toBeVisible();
  await page.getByTestId('trend-analyze-confirm-cancel').click();
  await expect(page.getByTestId('trend-analyze-confirm-run')).toHaveCount(0);

  expect(ledger.analyzePosts).toHaveLength(0);
  expect(ledger.monitoringMutations).toBe(0);
  expect(ledger.privateProviderPosts).toBe(0);
  expect(ledger.dialogEvents).toHaveLength(0);
  expect(ledger.pageErrors).toEqual([]);
  expect(ledger.consoleErrors).toEqual([]);
});

test('Scenario B — one confirmed analysis POST', async ({ page, context }) => {
  test.skip(!process.env.TREND_E2E_ANALYZE_ENABLED, 'requires trader-capable fixture');

  const ledger: Ledger = {
    consoleErrors: [],
    pageErrors: [],
    analyzePosts: [],
    settingsPatches: [],
    settingsGets: 0,
    monitoringMutations: 0,
    privateProviderPosts: 0,
    dialogEvents: [],
  };
  attachLedger(page, ledger);

  await performRealLogin(page, context);
  await openTrendWorkspace(page);
  await waitTrendOverviewReady(page);

  const runBtn = page.getByTestId('trend-run-analytical-analysis');
  await expect(runBtn).toBeEnabled({ timeout: 15_000 });

  await runBtn.click();
  await page.getByTestId('trend-analyze-confirm-cancel').click();
  expect(ledger.analyzePosts).toHaveLength(0);

  await runBtn.click();
  const analyzeResponse = page.waitForResponse(
    (r) => r.url().includes('/trend/analyze') && r.request().method() === 'POST',
    { timeout: 120_000 },
  );
  await page.getByTestId('trend-analyze-confirm-run').click();
  const resp = await analyzeResponse;
  expect(resp.status()).toBeGreaterThanOrEqual(200);
  expect(resp.status()).toBeLessThan(500);
  expect(ledger.analyzePosts).toHaveLength(1);

  await waitTrendOverviewReady(page);
  await page.getByTestId('trend-tab-evidence').click();
  await expect(page.getByTestId('trend-panel-evidence')).toBeVisible();
  await page.getByTestId('trend-tab-history').click();
  await expect(page.getByTestId('trend-panel-history')).toBeVisible();

  expect(ledger.dialogEvents).toHaveLength(0);
  expect(ledger.pageErrors).toEqual([]);
  expect(ledger.consoleErrors).toEqual([]);
});

test('Scenario C — settings PATCH persists', async ({ page, context }) => {
  test.skip(!process.env.TREND_E2E_ANALYZE_ENABLED, 'requires trader-capable fixture');

  const ledger: Ledger = {
    consoleErrors: [],
    pageErrors: [],
    analyzePosts: [],
    settingsPatches: [],
    settingsGets: 0,
    monitoringMutations: 0,
    privateProviderPosts: 0,
    dialogEvents: [],
  };
  attachLedger(page, ledger);

  await performRealLogin(page, context);
  await openTrendWorkspace(page);
  await page.getByTestId('trend-tab-settings').click();
  await expect(page.getByTestId('trend-settings-symbol')).toBeVisible();

  const symbolInput = page.getByTestId('trend-settings-symbol');
  const prior = await symbolInput.inputValue();
  const next = prior === 'ETH/USDT' ? 'BTC/USDT' : 'ETH/USDT';
  await symbolInput.fill(next);

  const patchWait = page.waitForResponse(
    (r) => r.url().includes('/trend/settings') && r.request().method() === 'PATCH',
    { timeout: 30_000 },
  );
  await page.getByTestId('trend-settings-save').click();
  const patchResp = await patchWait;
  expect(patchResp.status()).toBeGreaterThanOrEqual(200);
  expect(patchResp.status()).toBeLessThan(500);
  expect(ledger.settingsPatches).toHaveLength(1);
});

test('Scenario A — FA mobile RTL read-only', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('titan_language', 'fa');
    localStorage.setItem('titan_migration_dismissed', 'true');
  });

  const ledger: Ledger = {
    consoleErrors: [],
    pageErrors: [],
    analyzePosts: [],
    settingsPatches: [],
    settingsGets: 0,
    monitoringMutations: 0,
    privateProviderPosts: 0,
    dialogEvents: [],
  };
  attachLedger(page, ledger);

  await performRealLogin(page, context);
  await openTrendWorkspace(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByTestId('trend-tab-overview').click();
  await expect(page.getByTestId('trend-tab-panel')).toBeVisible();
  expect(ledger.dialogEvents).toHaveLength(0);
});

const TREND_COMPARE_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;

async function configureCompareTimeframes(
  page: Page,
  primary: string,
  compares: string[],
) {
  await page.getByTestId('trend-tab-settings').click();
  await expect(page.getByTestId('trend-settings-symbol')).toBeVisible();

  await page.getByTestId('trend-settings-timeframe').selectOption(primary);

  for (const tf of TREND_COMPARE_TIMEFRAMES) {
    if (tf === primary) continue;
    const cb = page.getByTestId(`trend-settings-compare-${tf}`);
    if (await cb.isChecked().catch(() => false)) {
      await cb.uncheck();
    }
  }
  for (const tf of compares) {
    await page.getByTestId(`trend-settings-compare-${tf}`).check();
  }

  const patchWait = page.waitForResponse(
    (r) => r.url().includes('/trend/settings') && r.request().method() === 'PATCH',
    { timeout: 30_000 },
  );
  await page.getByTestId('trend-settings-save').click();
  const patchResp = await patchWait;
  expect(patchResp.status()).toBeGreaterThanOrEqual(200);
  expect(patchResp.status()).toBeLessThan(500);
  const patchBody = await patchResp.json();
  expect(patchBody.settings?.compareTimeframes?.sort()).toEqual([...compares].sort());
}

async function runMtfAnalysisScenario(
  page: Page,
  ledger: Ledger,
  primary: string,
  compares: string[],
) {
  await configureCompareTimeframes(page, primary, compares);

  await page.getByTestId('trend-tab-overview').click();
  await waitTrendOverviewReady(page);

  const runBtn = page.getByTestId('trend-run-analytical-analysis');
  await expect(runBtn).toBeEnabled({ timeout: 15_000 });
  await runBtn.click();

  for (const tf of compares) {
    await expect(page.getByTestId('trend-analyze-confirm-form')).toContainText(tf);
  }

  const analyzeResponse = page.waitForResponse(
    (r) => r.url().includes('/trend/analyze') && r.request().method() === 'POST',
    { timeout: 120_000 },
  );
  await page.getByTestId('trend-analyze-confirm-run').click();
  const resp = await analyzeResponse;
  expect(resp.status()).toBeGreaterThanOrEqual(200);
  expect(resp.status()).toBeLessThan(500);
  expect(ledger.analyzePosts).toHaveLength(1);

  const body = await resp.json();
  expect(body.multiTimeframe?.length).toBe(compares.length);
  expect(body.mtfSummary?.requestedCount).toBe(compares.length);
  expect(body.mtfSummary?.completedCount + body.mtfSummary?.unavailableCount + body.mtfSummary?.failedCount).toBe(
    compares.length,
  );

  await waitTrendOverviewReady(page);
  await page.getByTestId('trend-tab-multiTimeframe').click();
  await expect(page.getByTestId('trend-mtf-matrix')).toBeVisible({ timeout: 30_000 });

  for (const tf of [primary, ...compares]) {
    await expect(page.getByTestId(`trend-mtf-row-${tf}`)).toBeVisible();
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto('/?view=ai', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await dismissMigrationIfPresent(page);
  await page.locator('[data-ai-tab="agents"]').first().click({ timeout: 15_000 });
  await page.getByTestId('agent-open-trend').click();
  await expect(page.getByTestId('trend-workspace')).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('trend-tab-multiTimeframe').click();
  await expect(page.getByTestId('trend-mtf-matrix')).toBeVisible({ timeout: 45_000 });
  for (const tf of [primary, ...compares]) {
    await expect(page.getByTestId(`trend-mtf-row-${tf}`)).toBeVisible();
  }
}

test('Scenario MTF-1 — primary 1h + compare 30m/15m matrix persists', async ({ page, context }) => {
  test.skip(!process.env.TREND_E2E_ANALYZE_ENABLED, 'requires trader-capable fixture');
  test.setTimeout(180_000);

  const ledger: Ledger = {
    consoleErrors: [],
    pageErrors: [],
    analyzePosts: [],
    settingsPatches: [],
    settingsGets: 0,
    monitoringMutations: 0,
    privateProviderPosts: 0,
    dialogEvents: [],
  };
  attachLedger(page, ledger);

  await performRealLogin(page, context);
  await openTrendWorkspace(page);
  await runMtfAnalysisScenario(page, ledger, '1h', ['30m', '15m']);

  expect(ledger.privateProviderPosts).toBe(0);
  expect(ledger.monitoringMutations).toBe(0);
  expect(ledger.pageErrors).toEqual([]);
  expect(ledger.consoleErrors).toEqual([]);
});

test('Scenario MTF-2 — primary 4h + compare 1h/30m matrix persists', async ({ page, context }) => {
  test.skip(!process.env.TREND_E2E_ANALYZE_ENABLED, 'requires trader-capable fixture');
  test.setTimeout(180_000);

  const ledger: Ledger = {
    consoleErrors: [],
    pageErrors: [],
    analyzePosts: [],
    settingsPatches: [],
    settingsGets: 0,
    monitoringMutations: 0,
    privateProviderPosts: 0,
    dialogEvents: [],
  };
  attachLedger(page, ledger);

  await performRealLogin(page, context);
  await openTrendWorkspace(page);
  await runMtfAnalysisScenario(page, ledger, '4h', ['1h', '30m']);

  expect(ledger.privateProviderPosts).toBe(0);
  expect(ledger.monitoringMutations).toBe(0);
  expect(ledger.pageErrors).toEqual([]);
  expect(ledger.consoleErrors).toEqual([]);
});
