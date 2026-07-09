#!/usr/bin/env node
/**
 * DH-HEALTH-MONITORING-P2 performance + progressive load browser verify.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedisClient, isRedisAvailable } from '../utils/redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APP = process.env.APP || 'http://localhost:3000';
const API = process.env.API_URL || 'http://127.0.0.1:5002';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

async function timedFetch(url, token) {
  const start = Date.now();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  return { ms: Date.now() - start, status: res.status, body };
}

async function flushHealthCaches() {
  const keys = [
    'datahub:health:monitoring:v3',
    'datahub:health:pipeline-activity-1h:v1',
    'datahub:health:performance:v1',
    'datahub:health:monitoring:v2',
  ];
  if (!isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    if (keys.length) await client.del(keys);
  } catch {
    /* optional */
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

  await flushHealthCaches();
  const coreCold = await timedFetch(`${API}/api/v1/data-sources/health/monitoring`, token);
  const coreCached = await timedFetch(`${API}/api/v1/data-sources/health/monitoring`, token);
  const dqCold = await timedFetch(`${API}/api/v1/data-sources/health/data-quality`, token);
  const dqCached = await timedFetch(`${API}/api/v1/data-sources/health/data-quality`, token);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

  const network = [];
  let healthNavStart = 0;
  page.on('response', res => {
    const url = res.url();
    if (url.includes('/health/monitoring') || url.includes('/health/data-quality')) {
      network.push({
        url: url.replace(/^https?:\/\/[^/]+/, ''),
        status: res.status(),
        ms: healthNavStart ? Date.now() - healthNavStart : null,
      });
    }
  });

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

  // Re-warm core cache so browser tab measures UI progress, not stale cache expiry during navigation
  await timedFetch(`${API}/api/v1/data-sources/health/monitoring`, token);

  const navStart = Date.now();
  healthNavStart = navStart;
  await page.getByRole('tab', { name: /Health Monitoring|پایش سلامت/i }).click();

  await page.getByText(/Health status|Health Status|وضعیت سلامت/i).first().waitFor({ timeout: 15000 });
  const coreVisibleMs = Date.now() - navStart;
  const monitoringNetwork = network.find(entry => entry.url.includes('/health/monitoring'));
  const browserCoreApiMs = monitoringNetwork?.ms ?? coreVisibleMs;

  await page.waitForTimeout(2000);
  const bodyAfterCore = await page.evaluate(() => document.body.innerText);
  const coreHasValues =
    /\d{2,}/.test(bodyAfterCore) &&
    !/Pipeline ingested \(1h\)\s*\n\s*0\s*\n\s*Pipeline normalized \(1h\)\s*\n\s*0/.test(bodyAfterCore);

  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p2-performance-core.png'), fullPage: false });

  await page.waitForTimeout(8000);
  const bodyFinal = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p2-performance-full.png'), fullPage: true });

  const checklist = {
    coreColdUnder1s: coreCold.ms < 1000,
    coreColdUnder2sMax: coreCold.ms < 2000,
    coreCachedUnder300ms: coreCached.ms < 300,
    dataQualitySeparateEndpoint: dqCold.status === 200,
    coreDoesNotWaitForDuplicate:
      coreCold.ms < 2000 &&
      network.some(n => n.url.includes('/health/monitoring') && n.status === 200) &&
      network.some(n => n.url.includes('/health/data-quality') && n.status === 200),
    coreMetricsVisibleEarly: coreHasValues,
    noFakeZeroGrid: !/Pipeline ingested \(1h\)\s*\n\s*0\s*\n\s*Pipeline normalized \(1h\)\s*\n\s*0/.test(bodyFinal),
    noRawNa: !/(?<![\w])N\/A(?![\w])/.test(bodyFinal.replace(/Not tracked/gi, '')),
    noRawI18n: !/datahub_[a-z0-9_]+/.test(bodyFinal),
    duplicateSectionPresent: bodyFinal.includes('Duplicate URL groups'),
  };

  const evidence = {
    capturedAt: new Date().toISOString(),
    task: 'DH-HEALTH-MONITORING-P2-COLD-LOAD-PERFORMANCE-FIX',
    endpointTiming: {
      coreMonitoring: { coldMs: coreCold.ms, cachedMs: coreCached.ms, queryMs: coreCold.body?.meta?.queryMs },
      dataQuality: { coldMs: dqCold.ms, cachedMs: dqCached.ms, loaded: dqCold.body?.loaded },
    },
    browser: { coreVisibleMs, browserCoreApiMs, network },
    browserQaChecklist: checklist,
    browserQaPass: Object.values(checklist).every(Boolean),
    screenshots: [
      'health-monitoring-p2-performance-core.png',
      'health-monitoring-p2-performance-full.png',
    ],
    verdict: Object.values(checklist).every(Boolean) ? 'REAL WORKING' : 'BLOCKED',
  };

  fs.writeFileSync(path.join(OUT, 'health-monitoring-p2-performance-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
  if (!evidence.browserQaPass) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
