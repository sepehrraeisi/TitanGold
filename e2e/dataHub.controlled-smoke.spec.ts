import { test, expect, Page } from '@playwright/test';

const FAIL_TEXT = [
  'Not Found',
  'Resource not found',
  'undefined',
  'Undefined',
  'NaN',
  '75.0%',
];

async function maybeLogin(page: Page) {
  const isDashboard = (await page.locator('[data-testid="dashboard"], .dashboard').count()) > 0;
  if (isDashboard) return;

  const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="username" i]').first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();

  await page.waitForLoadState('networkidle');
  if (await usernameInput.isVisible().catch(() => false)) {
    await usernameInput.fill('dev');
    await passwordInput.fill('password');
    await loginButton.click();
    await page.waitForLoadState('networkidle');
  }
}

async function expectNoFailText(page: Page, label: string) {
  const bodyText = ((await page.locator('body').textContent()) || '').trim();
  for (const s of FAIL_TEXT) {
    expect(bodyText, `${label}: should not include "${s}"`).not.toContain(s);
  }
}

async function clickFirstVisible(page: Page, selectors: string[], stepLabel: string) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
      await el.click();
      await page.waitForTimeout(800);
      await expectNoFailText(page, stepLabel);
      return;
    }
  }
  throw new Error(`${stepLabel}: no selector matched: ${selectors.join(' OR ')}`);
}

test.describe('Controlled smoke: AI Center → Data Hub', () => {
  test('DataHub loads; tabs work; no raw errors; cache hit not 75%', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const httpErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', req => {
      failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'requestfailed'}`);
    });
    page.on('response', res => {
      if (res.status() >= 400) {
        httpErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    // Prevent Preferences Migration modal from blocking navigation.
    await page.addInitScript(() => {
      localStorage.setItem('titan_migration_dismissed', 'true');
    });

    // 1) Route: /?view=ai
    await page.goto('/?view=ai');
    await maybeLogin(page);
    await page.waitForTimeout(1200);
    await expectNoFailText(page, 'after /?view=ai');

    // 2) AI Center first-class Data Hub tab
    await clickFirstVisible(
      page,
      [
        '[data-ai-tab="data_hub"]',
        'button:has-text("Data Hub")',
        'button:has-text("دیتا هاب")',
        'button:has-text("هاب داده")',
      ],
      'AICenter: open Data Hub',
    );

    const dataHubReady = page.locator('[data-datahub-owner="canonical"], button:has-text("Sources"), button:has-text("Data Sources")').first();
    try {
      await dataHubReady.waitFor({ state: 'visible', timeout: 20000 });
    } catch {
      await page.screenshot({ path: 'test-results/datahub-smoke-ai-center-loading-failed.png', fullPage: true });
      const dump = [
        'Data Hub loading blocker: canonical workspace not visible within 20s after AI Center Data Hub tab.',
        '',
        'Console errors:',
        ...(consoleErrors.length ? consoleErrors : ['(none)']),
        '',
        'Request failed:',
        ...(failedRequests.length ? failedRequests : ['(none)']),
        '',
        'HTTP >=400:',
        ...(httpErrors.length ? httpErrors : ['(none)']),
      ].join('\n');
      throw new Error(dump);
    }

    // 4) Check key surfaces (we only enforce "no raw fail strings" + cache not 75.0%)
    await expectNoFailText(page, 'DataHub: initial render');

    // Main tabs
    const mainTabs = [
      ['button:has-text("Sources")', 'button:has-text("Data Sources")'],
      ['button:has-text("Categories")'],
      ['button:has-text("Pipeline")', 'button:has-text("Data Pipeline")'],
      ['button:has-text("Health")', 'button:has-text("Health Monitoring")'],
      ['button:has-text("Logs")', 'button:has-text("Access Logs")'],
      ['button:has-text("Advanced")', 'button:has-text("Advanced Features")'],
      ['button:has-text("Telegram")', 'button:has-text("Telegram Collector")'],
    ];

    for (const selectors of mainTabs) {
      await clickFirstVisible(page, selectors, `DataHub: main tab ${selectors[0]}`);
    }

    // Advanced subtabs (must open Advanced first)
    await clickFirstVisible(page, ['button:has-text("Advanced")', 'button:has-text("Advanced Features")'], 'DataHub: open Advanced');

    const advancedSubtabs = [
      ['button:has-text("Web Crawlers")'],
      ['button:has-text("Auto Discovery")'],
      ['button:has-text("Smart Prioritization")'],
      ['button:has-text("Access Control")'],
      ['button:has-text("Safety Filtering")', 'button:has-text("Blacklist/Whitelist")'],
      ['button:has-text("Telegram Publisher")'],
      ['button:has-text("Automation")', 'button:has-text("Automation Routing")'],
      ['button:has-text("Archiving")', 'button:has-text("Data Archiving")'],
    ];

    for (const selectors of advancedSubtabs) {
      await clickFirstVisible(page, selectors, `Advanced: subtab ${selectors[0]}`);
    }

    // Explicitly ensure cache hit mock never appears.
    const finalText = ((await page.locator('body').textContent()) || '').trim();
    expect(finalText).not.toContain('75.0%');
  });
});

