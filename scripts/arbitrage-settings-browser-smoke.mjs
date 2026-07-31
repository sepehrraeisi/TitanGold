#!/usr/bin/env node
/**
 * Focused Settings browser smoke on deployed Staging HEAD.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const dotenv = require('/home/ubuntu/webapp/TitanGold/backend/node_modules/dotenv');
const jwt = require('/home/ubuntu/webapp/TitanGold/backend/node_modules/jsonwebtoken');
const { chromium } = require('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.TITAN_BACKEND_ENV_FILE || '/home/ubuntu/webapp/TitanGold/backend/.env' });

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://titan.zala.ir';
const AGENT_ID = process.env.ARB_QA_AGENT_ID || '04b6ca95-5fd3-471d-a568-bd7f1c391d83';
const OUT = process.env.QA_REPORT_DIR || path.join(__dirname, '../e2e/settings-closeout-smoke');

function mintToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  return jwt.sign(
    { userId: process.env.DEPLOY_SMOKE_ADMIN_ID || 'e134c7b1-b183-4e21-9acf-e3d53b9806d6', role: 'admin' },
    secret,
    { expiresIn: '2h' },
  );
}

async function runScenario(page, { locale, dir, viewport, label }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ localeValue, dirValue, token }) => {
    localStorage.setItem('titan_language', localeValue);
    localStorage.setItem('titan_token', token);
    document.documentElement.dir = dirValue;
    document.documentElement.lang = localeValue;
  }, { localeValue: locale, dirValue: dir, token: mintToken() });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(`${BASE}/?view=ai&agentId=${AGENT_ID}&agentSection=settings`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  });

  await page.waitForSelector('[data-testid="arb-settings"]', { timeout: 60000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const bodyText = await page.locator('[data-testid="arb-settings"]').innerText();
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    settings: (() => {
      const el = document.querySelector('[data-testid="arb-settings"]');
      return el ? el.scrollWidth > el.clientWidth + 2 : false;
    })(),
  }));

  const grossHint = await page.locator('[data-testid="arb-settings-gross-spread-hint"]').innerText().catch(() => '');
  const rawKey = /\barb_[a-z0-9_]+\b/.test(bodyText);
  const englishGrossLeak = locale === 'fa' && /Engine threshold; not editable/i.test(bodyText);
  const alerts = [];

  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true });

  return {
    label,
    locale,
    pass:
      consoleErrors.length === 0
      && pageErrors.length === 0
      && !rawKey
      && !englishGrossLeak
      && !overflow.doc
      && !overflow.settings
      && (locale !== 'fa' || grossHint.includes('موتور تحلیل')),
    consoleErrors,
    pageErrors,
    rawKey,
    englishGrossLeak,
    overflow,
    grossHint: grossHint.slice(0, 120),
    alerts,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const scenarios = [
    { locale: 'en', dir: 'ltr', viewport: { width: 1440, height: 900 }, label: 'en-desktop' },
    { locale: 'fa', dir: 'rtl', viewport: { width: 1440, height: 900 }, label: 'fa-desktop' },
    { locale: 'fa', dir: 'rtl', viewport: { width: 390, height: 844 }, label: 'fa-mobile-portrait' },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(page, scenario));
  }
  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
