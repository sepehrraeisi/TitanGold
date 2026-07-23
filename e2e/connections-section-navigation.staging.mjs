/**
 * Staging Browser integration — Connections Manage section navigation.
 * Requires TITAN_STAGING_URL (default https://titan.zala.ir) and JWT mint.
 *
 * Run: node --input-type=module e2e/connections-section-navigation.staging.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from '../backend/node_modules/jsonwebtoken/index.js';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });
dotenv.config({ path: '/home/ubuntu/webapp/TitanGold/backend/.env' });

const BASE = process.env.TITAN_STAGING_URL || 'https://titan.zala.ir';
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('environment-blocked: JWT_SECRET missing');
  process.exit(2);
}

const TOKEN = jwt.sign(
  {
    id: 'e134c7b1-b183-4e21-9acf-e3d53b9806d6',
    userId: 'e134c7b1-b183-4e21-9acf-e3d53b9806d6',
    email: 'admin@titangold.com',
    role: 'Admin',
    username: 'sepehr',
  },
  SECRET,
  { expiresIn: '2h' },
);
const USER = {
  id: 'e134c7b1-b183-4e21-9acf-e3d53b9806d6',
  name: 'Admin',
  email: 'admin@titangold.com',
  username: 'sepehr',
  role: 'Admin',
};

const SECTIONS = [
  'overview',
  'credentials',
  'capabilities',
  'consumers',
  'verification-history',
  'danger-zone',
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const results = { executed: 0, passed: 0, failed: 0, skipped: 0, retried: 0, cases: [] };

async function check(name, fn) {
  results.executed += 1;
  try {
    await fn();
    results.passed += 1;
    results.cases.push({ name, ok: true });
  } catch (e) {
    results.failed += 1;
    results.cases.push({ name, ok: false, error: String(e?.message || e).slice(0, 300) });
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
let deleteCalls = 0;
let mexcHits = 0;
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('request', (req) => {
  if (/api\.mexc\.com/i.test(req.url())) mexcHits += 1;
  if (req.method() === 'DELETE' && /connections\/mexc/i.test(req.url())) deleteCalls += 1;
});

await page.addInitScript(
  ({ t, u }) => {
    localStorage.setItem('titan_token', t);
    sessionStorage.setItem('titan_token', t);
    localStorage.setItem('token', t);
    localStorage.setItem('titan_user', JSON.stringify(u));
    sessionStorage.setItem('titan_user', JSON.stringify(u));
    localStorage.setItem('titan_language', 'en');
    localStorage.setItem('titan_migration_dismissed', 'true');
    localStorage.setItem('titan_favorites_migration_dismissed', 'true');
  },
  { t: TOKEN, u: USER },
);

await page.goto(`${BASE}/?view=settings&settingsTab=connections&provider=mexc&section=overview`, {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(2500);
const manage = page.getByRole('button', { name: /Manage|Open|Collapse/i }).first();
if (await manage.count()) {
  const label = await manage.innerText().catch(() => '');
  if (!/Collapse/i.test(label)) await manage.click({ timeout: 3000 }).catch(() => {});
}
await page.waitForTimeout(1000);
await page.keyboard.press('Escape').catch(() => {});
await page.waitForSelector('[data-testid="mexc-connection-panel"]', { timeout: 20000 });

for (const section of SECTIONS) {
  await check(`click ${section} updates URL + active panel`, async () => {
    const before = page.url();
    const tab = page.locator(`[data-testid="mexc-section-tab-${section}"]`);
    assert(await tab.count(), `missing tab ${section}`);
    const box = await tab.boundingBox();
    assert(box, `no box for ${section}`);
    const efp = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.getAttribute('data-testid') || el?.tagName;
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    assert(
      efp === `mexc-section-tab-${section}` || efp === 'BUTTON',
      `elementFromPoint blocked: ${efp}`,
    );
    await tab.click({ force: false, timeout: 5000 });
    await page.waitForTimeout(350);
    const url = new URL(page.url());
    assert(url.searchParams.get('view') === 'settings', 'view lost');
    assert(url.searchParams.get('settingsTab') === 'connections', 'settingsTab lost');
    assert(url.searchParams.get('provider') === 'mexc', 'provider lost');
    assert(url.searchParams.get('section') === section, `section want ${section} got ${url.searchParams.get('section')} (was ${before})`);
    const active = await page.locator('[data-active-section]').getAttribute('data-active-section');
    assert(active === section, `activeSection want ${section} got ${active}`);
    assert(
      (await tab.getAttribute('aria-selected')) === 'true',
      `aria-selected not true for ${section}`,
    );
  });
}

await check('View consumers navigates to consumers', async () => {
  await page.locator('[data-testid="mexc-section-tab-overview"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="mexc-view-consumers"]').click();
  await page.waitForTimeout(350);
  const url = new URL(page.url());
  assert(url.searchParams.get('section') === 'consumers', 'view consumers section');
  assert((await page.locator('[data-active-section]').getAttribute('data-active-section')) === 'consumers');
  assert(await page.locator('[data-testid="mexc-section-consumers"], #mexc-panel-consumers').count());
});

await check('invalid section falls back to overview once', async () => {
  await page.goto(`${BASE}/?view=settings&settingsTab=connections&provider=mexc&section=not-real`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape').catch(() => {});
  const manage2 = page.getByRole('button', { name: /Manage|Open/i }).first();
  if (await manage2.count()) await manage2.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(800);
  const active = await page.locator('[data-active-section]').getAttribute('data-active-section').catch(() => null);
  assert(active === 'overview' || active === null, `fallback active=${active}`);
});

await check('hard refresh keeps credentials', async () => {
  await page.goto(`${BASE}/?view=settings&settingsTab=connections&settingsSubtab=mexc-manage&provider=mexc&section=credentials`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape').catch(() => {});
  const active = await page.locator('[data-active-section]').getAttribute('data-active-section');
  assert(active === 'credentials', `refresh credentials got ${active}`);
});

await check('Back/Forward across sections', async () => {
  await page.goto(`${BASE}/?view=settings&settingsTab=connections&settingsSubtab=mexc-manage&provider=mexc&section=overview`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape').catch(() => {});
  for (const s of ['credentials', 'capabilities', 'consumers']) {
    await page.locator(`[data-testid="mexc-section-tab-${s}"]`).click();
    await page.waitForTimeout(250);
  }
  await page.goBack();
  await page.waitForTimeout(300);
  assert((await page.locator('[data-active-section]').getAttribute('data-active-section')) === 'capabilities');
  await page.goBack();
  await page.waitForTimeout(300);
  assert((await page.locator('[data-active-section]').getAttribute('data-active-section')) === 'credentials');
  await page.goForward();
  await page.waitForTimeout(300);
  assert((await page.locator('[data-active-section]').getAttribute('data-active-section')) === 'capabilities');
});

await check('no pageerrors / no provider / no delete', async () => {
  const bad = pageErrors.filter((e) => /setConfirmDelete|ReferenceError/i.test(e));
  assert(bad.length === 0, `pageerrors: ${bad.join(' | ')}`);
  assert(mexcHits === 0, `mexc hits ${mexcHits}`);
  assert(deleteCalls === 0, `delete calls ${deleteCalls}`);
});

// FA smoke
await check('FA View consumers label + navigation', async () => {
  await page.evaluate(() => {
    localStorage.setItem('titan_language', 'fa');
    localStorage.setItem('language', 'fa');
  });
  await page.goto(`${BASE}/?view=settings&settingsTab=connections&settingsSubtab=mexc-manage&provider=mexc&section=overview`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape').catch(() => {});
  const vc = page.locator('[data-testid="mexc-view-consumers"]');
  assert(await vc.count(), 'FA view consumers missing');
  await vc.click();
  await page.waitForTimeout(350);
  assert(new URL(page.url()).searchParams.get('section') === 'consumers');
});

// mobile
await check('mobile portrait tabs reachable', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/?view=settings&settingsTab=connections&settingsSubtab=mexc-manage&provider=mexc&section=overview`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('[data-testid="mexc-section-tab-danger-zone"]').click();
  await page.waitForTimeout(300);
  assert(new URL(page.url()).searchParams.get('section') === 'danger-zone');
});

fs.writeFileSync('/tmp/connections-section-nav-qa.json', JSON.stringify({ results, pageErrors, mexcHits, deleteCalls }, null, 2));
console.log(JSON.stringify({ results, pageErrorsCount: pageErrors.length, mexcHits, deleteCalls }, null, 2));
await browser.close();
process.exit(results.failed ? 1 : 0);
