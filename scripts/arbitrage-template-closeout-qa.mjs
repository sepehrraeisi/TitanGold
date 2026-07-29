#!/usr/bin/env node
/**
 * Template/Overview closeout browser QA — separates harness vs product errors.
 */
import dotenv from 'dotenv';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const jwt = require('/home/ubuntu/webapp/TitanGold/backend/node_modules/jsonwebtoken');
const { chromium } = require('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.TITAN_BACKEND_ENV_FILE || '/home/ubuntu/webapp/TitanGold/backend/.env' });

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://titan.zala.ir';
const OUT = process.env.QA_REPORT_DIR || path.join(__dirname, '../e2e/confirm-layer-closeout-qa');
const AGENT_ID = '04b6ca95-5fd3-471d-a568-bd7f1c391d83';

function mintToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  return jwt.sign({ userId: 'e134c7b1-b183-4e21-9acf-e3d53b9806d6', role: 'admin' }, secret, { expiresIn: '2h' });
}

function safeSetDocumentDirection(page, locale, dir) {
  return page.addInitScript(({ localeValue, dirValue }) => {
    localStorage.setItem('titan_language', localeValue);
    const apply = () => {
      if (document.documentElement) {
        document.documentElement.dir = dirValue;
        document.documentElement.lang = localeValue === 'fa' ? 'fa' : 'en';
      }
    };
    apply();
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }, { localeValue: locale, dirValue: dir });
}

async function openPopup(page) {
  await page.goto(`${BASE}/?view=ai&_=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.locator('[data-ai-tab="agents"]').first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForSelector('[data-agent-key="arbitrage"]', { timeout: 30000 });
  await page.locator('[data-testid="agent-open-arbitrage"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="arb-overview"]', { timeout: 45000 });
}

const viewports = [
  { id: 'en-desktop', locale: 'en', dir: 'ltr', width: 1440, height: 900, runScan: true },
  { id: 'fa-desktop', locale: 'fa', dir: 'rtl', width: 1440, height: 900 },
  { id: 'tablet', locale: 'en', dir: 'ltr', width: 834, height: 1112 },
  { id: 'mobile-portrait', locale: 'en', dir: 'ltr', width: 390, height: 844 },
  { id: 'mobile-landscape', locale: 'en', dir: 'ltr', width: 844, height: 390 },
];

fs.mkdirSync(OUT, { recursive: true });
const token = mintToken();
const report = {
  bundle: null,
  results: [],
  productConsoleErrors: [],
  harnessErrors: [],
  productPageErrors: [],
  alerts: [],
  scan: null,
};

const html = await fetch(`${BASE}/?_=${Date.now()}`).then(r => r.text());
report.bundle = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? null;

const browser = await chromium.launch({ headless: true });

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const productConsoleErrors = [];
  const productPageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') productConsoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    const text = String(err);
    if (/Cannot set properties of null \(setting 'dir'\)/.test(text)) {
      report.harnessErrors.push(text);
    } else {
      productPageErrors.push(text);
    }
  });
  page.on('dialog', async d => {
    report.alerts.push(d.message());
    await d.dismiss();
  });

  await page.addInitScript(({ token }) => {
    localStorage.setItem('titan_token', token);
    localStorage.setItem('titan_user', JSON.stringify({ id: 'qa', role: 'admin' }));
    localStorage.setItem('titan_migration_dismissed', 'true');
  }, { token });
  await safeSetDocumentDirection(page, vp.locale, vp.dir);

  const scanPosts = [];
  page.on('response', res => {
    if (res.request().method() === 'POST' && /\/arbitrage\/scan/.test(res.url())) {
      scanPosts.push({ status: res.status(), url: res.url() });
    }
  });

  await openPopup(page);
  const before = await page.locator('[data-testid="agent-product-confirmation-layer"]').count();
  await page.getByTestId('arb-run-analytical-scan').click({ force: true });
  await page.waitForTimeout(500);

  const afterOpen = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="agent-product-confirmation-panel"]');
    const r = panel?.getBoundingClientRect();
    return {
      count: document.querySelectorAll('[data-testid="agent-product-confirmation-layer"]').length,
      activeElement: document.activeElement?.getAttribute('data-testid'),
      panelBox: r ? { w: r.width, h: r.height, top: r.top, left: r.left } : null,
    };
  });

  await page.screenshot({ path: path.join(OUT, `${vp.id}-confirm-open.png`) });

  await page.getByTestId('arb-scan-confirm-cancel').click({ force: true });
  await page.waitForTimeout(500);
  const afterCancel = await page.evaluate(() => ({
    count: document.querySelectorAll('[data-testid="agent-product-confirmation-layer"]').length,
    activeElement: document.activeElement?.getAttribute('data-testid'),
    orphanBackdrop: document.querySelectorAll('[data-testid="agent-product-confirmation-backdrop"]').length,
  }));

  await page.getByTestId('arb-run-analytical-scan').click({ force: true });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const afterEscape = await page.evaluate(() => ({
    count: document.querySelectorAll('[data-testid="agent-product-confirmation-layer"]').length,
    activeElement: document.activeElement?.getAttribute('data-testid'),
  }));

  let scan = null;
  if (vp.runScan) {
    const postsBefore = scanPosts.length;
    await page.getByTestId('arb-run-analytical-scan').click({ force: true });
    await page.waitForTimeout(400);
    const postsBeforeConfirm = scanPosts.length;
    await page.getByTestId('arb-scan-confirm-run').click({ force: true });
    await page.waitForTimeout(12000);
    scan = {
      postsBefore,
      postsBeforeConfirm,
      postsAfter: scanPosts.length,
      posts: scanPosts,
      redirectStatuses: scanPosts.filter(p => [301, 302, 307, 308].includes(p.status)).length,
      feedback: await page.locator('[data-testid="arb-scan-feedback"]').textContent().catch(() => null),
    };
    report.scan = scan;
  }

  report.results.push({
    viewport: vp.id,
    before,
    afterOpen,
    afterCancel,
    afterEscape,
    scanPosts: scanPosts.length,
    productConsoleErrors,
    productPageErrors,
  });
  report.productConsoleErrors.push(...productConsoleErrors);
  report.productPageErrors.push(...productPageErrors);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
