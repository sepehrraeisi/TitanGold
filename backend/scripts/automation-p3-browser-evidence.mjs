/**
 * Capture Automation P3 browser/API evidence for SSOT doc.
 * Run: cd backend && node scripts/automation-p3-browser-evidence.mjs
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
const EVIDENCE = path.join(ROOT, 'docs/ssot_v3/screenshots/automation-p3-network-evidence.json');

const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const BASE = process.env.API_BASE || 'http://localhost:5002';

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const t0 = Date.now();
  const overviewRes = await fetch(`${BASE}/api/v1/data-hub/automation/overview`, { headers });
  const overview = await overviewRes.json();
  const tOverview = Date.now() - t0;

  const t1 = Date.now();
  const refreshRes = await fetch(`${BASE}/api/v1/data-hub/automation/queue/refresh`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const refresh = await refreshRes.json();
  const tRefresh = Date.now() - t1;

  const execRes = await fetch(`${BASE}/api/v1/data-hub/automation/executions?limit=5`, { headers });
  const executions = await execRes.json();

  const evidence = {
    capturedAt: new Date().toISOString(),
    overview: {
      status: overviewRes.status,
      durationMs: tOverview,
      health: overview.health,
      summary: overview.summary,
      topics: (overview.topics || []).map(t => ({
        id: t.id,
        title: t.title || t.name,
        validity: t.validity,
      })),
    },
    refresh: {
      status: refreshRes.status,
      durationMs: tRefresh,
      summary: refresh.summary,
    },
    executions: (Array.isArray(executions) ? executions : executions.executions || [])
      .slice(0, 5)
      .map(e => ({
        status: e.status,
        errorCode: e.errorCode,
        errorLabel: e.errorLabel,
        retryAllowed: e.retryAllowed,
        isStale: e.isStale,
      })),
    performance: {
      overviewMs: tOverview,
      refreshMs: tRefresh,
    },
  };

  fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log('Wrote', EVIDENCE);
  console.log('Overview', tOverview, 'ms | Refresh', tRefresh, 'ms');

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:3000/?view=ai', { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(t => localStorage.setItem('titan_token', t), token);
    await page.reload({ waitUntil: 'networkidle' });

    const nav = async () => {
      await page.getByRole('button', { name: 'Manager' }).click();
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'Data Hub' }).click();
      await page.waitForTimeout(2000);
      await page.getByRole('tab', { name: 'Advanced Features' }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('tab', { name: 'Automation Routing' }).click();
      await page.waitForTimeout(8000);
    };
    await nav();

    await page.screenshot({
      path: path.join(SHOT_DIR, 'automation-p3-overview.png'),
      fullPage: true,
    });

    const validateBtn = page.getByRole('button', { name: /Validate/i }).first();
    if (await validateBtn.count()) {
      await validateBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'automation-p3-topic-validation.png'),
        fullPage: true,
      });
    }

    await page.getByRole('button', { name: 'Refresh' }).click();
    await page.waitForTimeout(Math.min(tRefresh + 2000, 45000));
    await page.screenshot({
      path: path.join(SHOT_DIR, 'automation-p3-queue.png'),
      fullPage: true,
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SHOT_DIR, 'automation-p3-history.png'),
      fullPage: true,
    });

    await browser.close();
    console.log('Screenshots saved to', SHOT_DIR);
  } catch (err) {
    console.warn('Playwright screenshots skipped:', err.message);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
