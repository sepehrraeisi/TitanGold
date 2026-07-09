#!/usr/bin/env node
/**
 * DH-HEALTH-MONITORING-P2 closeout — production browser QA + regression tabs.
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
  const body = await res.json().catch(() => ({}));
  return { ms: Date.now() - start, status: res.status, body };
}

async function flushHealthCaches() {
  const keys = [
    'datahub:health:monitoring:v3',
    'datahub:health:pipeline-activity-1h:v1',
    'datahub:health:performance:v1',
    'datahub:health:data-quality:v1',
    'datahub:health:monitoring:v2',
  ];
  if (!isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    await client.del(keys);
  } catch {
    /* optional */
  }
}

function bodyQualityChecks(text) {
  const rawI18n = (text.match(/datahub_[a-z0-9_]+/g) || []).filter((v, i, a) => a.indexOf(v) === i);
  return {
    noFakeZeroGrid: !/Pipeline ingested \(1h\)\s*\n\s*0\s*\n\s*Pipeline normalized \(1h\)\s*\n\s*0/.test(text),
    noRawNa: !/(?<![\w])N\/A(?![\w])/.test(text.replace(/Not tracked/gi, '')),
    noRawDashOnly: !/Duplicate URL groups\s*\n\s*—/.test(text),
    noRawI18n: rawI18n.length === 0,
    rawI18nKeysFound: rawI18n,
    hasRealCounts: /\d{2,}/.test(text),
    duplicateSectionPresent: /Duplicate URL groups|گروه‌های URL تکراری/i.test(text),
    dataQualitySeparateHint: /load on demand|جداگانه|separately/i.test(text),
    telegramCollectorSection: /Telegram Collector Health|سلامت جمع‌آور/i.test(text),
    collectorHasStatusOrUnavailable:
      /Collector status|وضعیت جمع|Healthy|Degraded|Unavailable|Unavailable|نامشخص/i.test(text),
  };
}

async function tabVisibleMs(page, tabPattern, readyPattern) {
  const start = Date.now();
  await page.getByRole('tab', { name: tabPattern }).click();
  await page.getByText(readyPattern).first().waitFor({ timeout: 20000 });
  return Date.now() - start;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

  await flushHealthCaches();
  const coreCold = await timedFetch(`${API}/api/v1/data-sources/health/monitoring`, token);
  const coreCached = await timedFetch(`${API}/api/v1/data-sources/health/monitoring`, token);
  const dq = await timedFetch(`${API}/api/v1/data-sources/health/data-quality`, token);
  const pipelineCold = await timedFetch(`${API}/api/v1/data-sources/pipeline/backlog`, token);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });

  const network = [];
  let healthNavStart = 0;
  page.on('response', res => {
    const url = res.url();
    if (
      url.includes('/health/monitoring') ||
      url.includes('/health/data-quality') ||
      url.includes('/pipeline/backlog') ||
      url.includes('/telegram-collector/health')
    ) {
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

  healthNavStart = Date.now();
  await page.getByRole('tab', { name: /Health Monitoring|پایش سلامت/i }).click();
  await page.getByText(/Health status|Health Status|وضعیت سلامت/i).first().waitFor({ timeout: 15000 });
  const healthCoreVisibleMs = Date.now() - healthNavStart;

  await page.waitForTimeout(1500);
  const healthBodyEarly = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p2-final-core.png'), fullPage: false });

  await page.waitForTimeout(6000);
  const healthBodyFinal = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p2-final-full.png'), fullPage: true });

  const healthChecks = bodyQualityChecks(healthBodyFinal);
  const healthDom = {
    ...healthChecks,
    coreCardsFast: coreCold.ms < 2000,
    coreMetricsVisibleEarly: /\d{2,}/.test(healthBodyEarly),
    noFullPageBlocking: !/Checking\.\.\.|در حال بررسی/i.test(healthBodyEarly) || healthChecks.hasRealCounts,
  };

  const pipelineVisibleMs = await tabVisibleMs(
    page,
    /Data Pipeline|خط لوله داده/i,
    /Pipeline backlog|بک‌لاگ|Normalization|نرمال/i,
  );
  await page.waitForTimeout(1500);
  const pipelineBody = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p2-final-pipeline-tab.png'), fullPage: false });
  const pipelineChecks = {
    tabLoads: pipelineVisibleMs < 15000,
    pipelineVisibleMs,
    pipelineApiColdMs: pipelineCold.ms,
    pipelineNotBlockedByHealth: pipelineCold.ms < 5000,
    noRawI18n: !/datahub_[a-z0-9_]+/.test(pipelineBody),
  };

  const telegramVisibleMs = await tabVisibleMs(
    page,
    /Telegram Collector|جمع‌آور تلگرام/i,
    /Telegram Collector|Channels|کانال/i,
  );
  await page.waitForTimeout(1500);
  const telegramBody = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'health-monitoring-p2-final-telegram-tab.png'), fullPage: false });
  const telegramChecks = {
    tabLoads: telegramVisibleMs < 15000,
    telegramVisibleMs,
    noRawI18n: !/datahub_[a-z0-9_]+/.test(telegramBody),
  };

  const checklist = {
    coreColdUnder2s: coreCold.ms < 2000,
    coreCachedUnder300ms: coreCached.ms < 300,
    dataQualitySeparateEndpoint: dq.status === 200,
    healthCoreVisibleUnder10s: healthCoreVisibleMs < 10000,
    coreDoesNotBlockOnDuplicate: healthDom.duplicateSectionPresent && healthDom.coreMetricsVisibleEarly,
    noFakeZeroGrid: healthDom.noFakeZeroGrid,
    noRawNa: healthDom.noRawNa,
    noRawI18n: healthDom.noRawI18n,
    telegramCollectorPresent: healthDom.telegramCollectorSection,
    collectorStatusShown: healthDom.collectorHasStatusOrUnavailable,
    pipelineTabNotSlowed: pipelineChecks.pipelineNotBlockedByHealth && pipelineChecks.tabLoads,
    telegramTabNotSlowed: telegramChecks.tabLoads,
  };

  const evidence = {
    capturedAt: new Date().toISOString(),
    task: 'DH-HEALTH-MONITORING-P2-COLD-LOAD-PERFORMANCE-FIX',
    closeout: true,
    endpointTiming: {
      coreMonitoring: { coldMs: coreCold.ms, cachedMs: coreCached.ms, queryMs: coreCold.body?.meta?.queryMs },
      dataQuality: { ms: dq.ms, loaded: dq.body?.loaded, reason: dq.body?.meta?.reason ?? null },
      pipelineBacklogColdMs: pipelineCold.ms,
    },
    browser: {
      healthCoreVisibleMs,
      network,
      healthDom,
      pipelineChecks,
      telegramChecks,
    },
    browserQaChecklist: checklist,
    browserQaPass: Object.values(checklist).every(Boolean),
    screenshots: [
      'health-monitoring-p2-final-core.png',
      'health-monitoring-p2-final-full.png',
      'health-monitoring-p2-final-pipeline-tab.png',
      'health-monitoring-p2-final-telegram-tab.png',
    ],
    verdict: Object.values(checklist).every(Boolean) ? 'REAL WORKING / CLOSED' : 'BLOCKED',
  };

  fs.writeFileSync(path.join(OUT, 'health-monitoring-p2-final-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
  if (!evidence.browserQaPass) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
