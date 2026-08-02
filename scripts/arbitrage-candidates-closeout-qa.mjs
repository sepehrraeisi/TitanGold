#!/usr/bin/env node
/**
 * Candidates localization + detail overlay browser QA on authenticated Staging.
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
const OUT = process.env.QA_REPORT_DIR || path.join(__dirname, '../e2e/candidates-closeout-qa');
const RAW_KEY_PATTERN = /\barb_[a-z0-9_]+\b|single_venue_spread_monitoring|mexc_public|\brejected\b(?!\s+candidates)/;

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

async function openCandidatesTab(page) {
  await page.goto(`${BASE}/?view=ai&_=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.locator('[data-ai-tab="agents"]').first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForSelector('[data-agent-key="arbitrage"]', { timeout: 30000 });
  await page.locator('[data-testid="agent-open-arbitrage"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="arb-overview"]', { timeout: 45000 });
  await page.getByTestId('arb-tab-candidates').click({ timeout: 15000 });
  await page.waitForSelector('[data-testid="arb-candidates-section"]', { timeout: 45000 });
  await page.waitForSelector('[data-testid^="arb-candidate-row-"]', { timeout: 45000 });
  await page.waitForTimeout(800);
}

function countRawKeys(text) {
  const matches = text.match(new RegExp(RAW_KEY_PATTERN, 'gi')) || [];
  return matches.filter(m => !['rejected'].includes(m.toLowerCase()) || m.includes('_')).length;
}

const scenarios = [
  { id: 'en-desktop-candidates', locale: 'en', dir: 'ltr', width: 1440, height: 900, shot: 'en-candidates-top' },
  { id: 'en-desktop-detail', locale: 'en', dir: 'ltr', width: 1440, height: 900, openDetail: true, shot: 'en-candidate-detail' },
  { id: 'fa-desktop-candidates', locale: 'fa', dir: 'rtl', width: 1440, height: 900, shot: 'fa-candidates' },
  { id: 'fa-desktop-detail', locale: 'fa', dir: 'rtl', width: 1440, height: 900, openDetail: true, shot: 'fa-candidate-detail' },
  { id: 'tablet-detail', locale: 'en', dir: 'ltr', width: 834, height: 1112, openDetail: true, shot: 'tablet-candidate-detail' },
  { id: 'mobile-portrait-detail-top', locale: 'en', dir: 'ltr', width: 390, height: 844, openDetail: true, shot: 'mobile-candidate-detail-top' },
  { id: 'mobile-portrait-detail-scroll', locale: 'en', dir: 'ltr', width: 390, height: 844, openDetail: true, scrollDetail: true, shot: 'mobile-candidate-detail-lower' },
  { id: 'mobile-landscape-detail', locale: 'en', dir: 'ltr', width: 844, height: 390, openDetail: true, shot: 'mobile-landscape-candidate-detail' },
];

fs.mkdirSync(OUT, { recursive: true });
const token = mintToken();
const report = {
  bundle: null,
  results: [],
  productConsoleErrors: [],
  productPageErrors: [],
  rawKeyTotal: 0,
};

const html = await fetch(`${BASE}/?_=${Date.now()}`).then(r => r.text());
report.bundle = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? null;

const browser = await chromium.launch({ headless: true });

for (const scenario of scenarios) {
  const ctx = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height } });
  const page = await ctx.newPage();
  const productConsoleErrors = [];
  const productPageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') productConsoleErrors.push(msg.text());
  });
  page.on('pageerror', err => productPageErrors.push(String(err)));

  await page.addInitScript(({ token }) => {
    localStorage.setItem('titan_token', token);
    localStorage.setItem('titan_user', JSON.stringify({ id: 'qa', role: 'admin' }));
    localStorage.setItem('titan_migration_dismissed', 'true');
  }, { token });
  await safeSetDocumentDirection(page, scenario.locale, scenario.dir);

  await openCandidatesTab(page);

  const candidatesText = await page.locator('[data-testid="arb-candidates-section"]').innerText();
  let rawKeys = countRawKeys(candidatesText);

  let detailMetrics = null;
  if (scenario.openDetail) {
    const row = page.locator('[data-testid^="arb-candidate-row-"]').first();
    await row.waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('[data-testid="agent-product-body"]').evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    await row.scrollIntoViewIfNeeded();
    await row.evaluate(el => el.click());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="arb-candidate-detail-panel"]') !== null,
      { timeout: 20000 },
    );
    await page.waitForTimeout(300);

    detailMetrics = await page.evaluate(() => {
      const dialog = document.querySelector('[data-testid="agent-product-dialog"]');
      const layer = document.querySelector('[data-testid="arb-candidate-detail-layer"]');
      const panel = document.querySelector('[data-testid="arb-candidate-detail-panel"]');
      const header = document.querySelector('[data-testid="agent-product-header"]');
      const closeBtn = document.querySelector('[data-testid="arb-candidate-detail-close"]');
      const panelRect = panel?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      const closeRect = closeBtn?.getBoundingClientRect();
      const dialogRect = dialog?.getBoundingClientRect();
      return {
        layerInsideDialog: Boolean(dialog && layer && dialog.contains(layer)),
        panelTop: panelRect?.top ?? null,
        headerBottom: headerRect?.bottom ?? null,
        closeVisible: Boolean(closeRect && closeRect.top >= 0 && closeRect.bottom <= window.innerHeight),
        closeAboveHeader: (closeRect?.top ?? 0) >= (headerRect?.bottom ?? 0) - 1 || (panelRect?.top ?? 0) <= (headerRect?.bottom ?? 0) + 2,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        dialogHeight: dialogRect?.height ?? null,
        activeElement: document.activeElement?.getAttribute('data-testid'),
      };
    });

    const detailText = await page.locator('[data-testid="arb-candidate-detail-body"]').innerText();
    rawKeys += countRawKeys(detailText);

    if (scenario.scrollDetail) {
      await page.locator('[data-testid="arb-candidate-detail-panel"]').evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: path.join(OUT, `${scenario.shot}.png`) });

    await page.getByTestId('arb-candidate-detail-close').click();
    await page.waitForTimeout(400);
    const afterClose = await page.evaluate(() => ({
      detailLayers: document.querySelectorAll('[data-testid="arb-candidate-detail-layer"]').length,
      backdrops: document.querySelectorAll('[data-testid="agent-product-detail-backdrop"]').length,
      activeElement: document.activeElement?.getAttribute('data-testid'),
    }));
    detailMetrics.afterClose = afterClose;
  } else {
    await page.screenshot({ path: path.join(OUT, `${scenario.shot}.png`) });
  }

  report.rawKeyTotal += rawKeys;
  report.results.push({
    scenario: scenario.id,
    rawKeys,
    detailMetrics,
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

const failed = report.results.some(r => r.rawKeys > 0 || r.productPageErrors.length > 0);
if (failed) process.exit(1);
