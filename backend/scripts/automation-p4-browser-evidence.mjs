/**
 * DH-AUTOMATION-ROUTING-P4 browser + API evidence.
 * Run: cd backend && node scripts/automation-p4-browser-evidence.mjs
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SHOT_DIR = path.join(ROOT, 'docs/ssot_v3/screenshots');
const EVIDENCE = path.join(SHOT_DIR, 'automation-p4-browser-evidence.json');

const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const BASE = process.env.API_BASE || 'http://localhost:5002';

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const network = [];
  for (const [method, pathSuffix] of [
    ['GET', '/api/v1/data-hub/automation/overview'],
    ['GET', '/api/v1/data-hub/automation/topics'],
    ['GET', '/api/v1/data-hub/automation/queue'],
    ['GET', '/api/v1/data-hub/automation/executions?limit=20'],
    ['POST', '/api/v1/data-hub/automation/queue/refresh'],
  ]) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}${pathSuffix}`, {
      method,
      headers,
      body: method === 'POST' ? '{}' : undefined,
    });
    network.push({ path: pathSuffix, method, status: res.status, ms: Date.now() - t0 });
  }

  const overviewRes = await fetch(`${BASE}/api/v1/data-hub/automation/overview`, { headers });
  const overview = await overviewRes.json();

  const evidence = {
    capturedAt: new Date().toISOString(),
    network,
    networkAll200: network.every(n => n.status === 200),
    summary: overview.summary,
    health: overview.health,
    topics: (overview.topics || []).map(t => ({
      id: t.id,
      title: t.title || t.name,
      validity: t.validity,
    })),
    queueCount: (overview.queue || []).length,
    rawKeys: [],
    consoleErrors: [],
    screenshots: [],
  };

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://localhost:3000/?view=ai', { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(t => {
      localStorage.setItem('titan_token', t);
      sessionStorage.setItem('titan_token', t);
    }, token);
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Manager' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Data Hub' }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: 'Advanced Features' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('tab', { name: 'Automation Routing' }).click();
    await page.waitForTimeout(8000);

    evidence.rawKeys = await page.evaluate(() => {
      const keys = [];
      document.querySelectorAll('*').forEach(el => {
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
          const t = el.textContent.trim();
          if (/^automation_[a-z0-9_]+$/.test(t)) keys.push(t);
        }
      });
      return [...new Set(keys)];
    });

    const bodyText = await page.evaluate(() => document.body.innerText);
    evidence.ui = {
      validTopics: bodyText.match(/Valid topics\s*\n\s*(\d+)/)?.[1],
      invalidTopics: bodyText.match(/Invalid topics\s*\n\s*(\d+)/)?.[1],
      queueSize: bodyText.match(/Queue size\s*\n\s*(\d+)/)?.[1],
      hasDeliveryHistory: bodyText.includes('Delivery History'),
      hasAutomationEvent: bodyText.includes('Automation event recorded'),
      notFound: bodyText.includes('Not Found'),
      dryRunOn: bodyText.includes('Dry run'),
    };

    await page.screenshot({ path: path.join(SHOT_DIR, 'automation-p4-post-repair-overview.png'), fullPage: true });
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h4')].find(h => h.textContent.includes('Automation queue'));
      el?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, 'automation-p4-post-repair-queue.png'), fullPage: true });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, 'automation-p4-post-repair-history.png'), fullPage: true });

    evidence.consoleErrors = consoleErrors;
    evidence.screenshots = [
      'automation-p4-post-repair-overview.png',
      'automation-p4-post-repair-queue.png',
      'automation-p4-post-repair-history.png',
    ];
    await browser.close();
  } catch (err) {
    evidence.playwrightError = err.message;
  }

  fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
