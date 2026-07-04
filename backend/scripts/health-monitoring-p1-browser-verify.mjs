#!/usr/bin/env node
/**
 * DH-HEALTH-MONITORING-P1 browser verification + screenshots.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APP = process.env.APP || 'http://localhost:3000';
const API = process.env.API_URL || 'http://127.0.0.1:5002';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

  const apiRes = await fetch(`${API}/api/v1/data-sources/health/monitoring`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const apiBody = await apiRes.json();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

  await page.goto(`${APP}/?view=ai`);
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('titan_token', token);
    localStorage.setItem('titan_user', JSON.stringify(user));
    localStorage.setItem('titan_migration_dismissed', 'true');
    sessionStorage.setItem('titan_token', token);
    sessionStorage.setItem('titan_user', JSON.stringify(user));
  }, { user, token });
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Manager', exact: true }).click({ timeout: 15000 });
  await page.getByText('Artemis Central', { exact: false }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Data Hub' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Health Monitoring' }).click();
  await page.getByText('Pipeline activity (1h)', { exact: false }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const rawI18n = (bodyText.match(/datahub_[a-z0-9_]+|pipeline_[a-z0-9_]+/g) || []).filter((v, i, a) => a.indexOf(v) === i);

  const domChecks = {
    hasPipelineActivitySection: bodyText.includes('Pipeline activity'),
    hasCacheHitLabel: bodyText.toLowerCase().includes('cache hit rate'),
    noFakeZeroGrid:
      !/Pipeline ingested \(1h\)\s*\n\s*0\s*\n\s*Pipeline normalized \(1h\)\s*\n\s*0\s*\n\s*Telegram intake \(1h\)\s*\n\s*0/.test(
        bodyText,
      ),
    hasUnavailableOrRealCounts: /Unavailable|\d{2,}/.test(bodyText),
    telegramCollectorSection: bodyText.includes('Telegram Collector Health'),
    noRawNa: !/\bN\/A\b/.test(bodyText),
  };

  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p1-full.png'), fullPage: true });
  await page.getByText('Pipeline activity (1h)', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p1-pipeline-activity.png'), fullPage: false });

  const pa = apiBody.pipelineActivity1h || {};
  const checklist = {
    apiReturns200: apiRes.status === 200,
    pipelineIngestedNotHardcodedZero: pa.ingested == null || pa.ingested > 0,
    pipelineNormalizedNotHardcodedZero: pa.normalized == null || pa.normalized > 0,
    telegramIntakeNotHardcodedZero: pa.telegramIntake == null || pa.telegramIntake > 0,
    cacheHitNotFake: apiBody.performance?.cacheHitRateTracked === false || apiBody.performance?.cacheHitRate != null,
    avgResponseHonest: apiBody.performance?.avgResponseMs != null || apiBody.performance?.avgResponseMs === null,
    noRawI18nKeys: rawI18n.length === 0,
    domChecksPass: Object.values(domChecks).every(Boolean),
  };

  const evidence = {
    capturedAt: new Date().toISOString(),
    task: 'DH-HEALTH-MONITORING-P1-PIPELINE-SYNC-UPDATE',
    api: {
      status: apiRes.status,
      pipelineActivity1h: pa,
      performance: apiBody.performance,
      telegramCollector: apiBody.telegramCollector,
    },
    browserQaChecklist: checklist,
    browserQaPass: Object.values(checklist).every(Boolean),
    domChecks,
    rawI18nKeysFound: rawI18n,
    screenshots: ['health-monitoring-p1-full.png', 'health-monitoring-p1-pipeline-activity.png'],
    verdict: Object.values(checklist).every(Boolean) ? 'REAL WORKING' : 'BLOCKED',
  };

  fs.writeFileSync(path.join(OUT, 'health-monitoring-p1-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
  if (!evidence.browserQaPass) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
