#!/usr/bin/env node
/**
 * DH-TELEGRAM-PUBLISHER-P3 runtime live mode control — browser QA
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

async function api(token, method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2h' });
  const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };
  const ts = new Date().toISOString();

  await api(token, 'PUT', '/api/v1/data-hub/telegram-publishers/runtime-mode', {
    mode: 'dry_run',
    confirm_runtime_mode_change: true,
    reason: 'P3 browser QA reset to dry-run baseline',
  });

  const initialMode = await api(token, 'GET', '/api/v1/data-hub/telegram-publishers/runtime-mode');
  const list = await api(token, 'GET', '/api/v1/data-hub/telegram-publishers');
  const pub = list.json.publishers?.find(p => p.is_active && p.has_bot_token);
  if (!pub) throw new Error('No active publisher with bot token');

  const mappings = await api(token, 'GET', '/api/v1/data-hub/telegram-publishers/mappings');
  const mapping = mappings.json.mappings?.find(m => m.publisher_id === pub.id && m.is_enabled);
  const sourceId = mapping?.source_id;

  const dryRunTest = await api(token, 'POST', `/api/v1/data-hub/telegram-publishers/${pub.id}/test`, {
    message: `TitanGold Publisher P3 dry-run check — ${ts}`,
  });

  const enableLiveTest = await api(token, 'PUT', '/api/v1/data-hub/telegram-publishers/runtime-mode', {
    mode: 'live_test',
    confirm_runtime_mode_change: true,
    acknowledge_live_delivery_risk: true,
    reason: 'P3 browser QA live_test window',
  });

  const liveTestSend = await api(token, 'POST', `/api/v1/data-hub/telegram-publishers/${pub.id}/test`, {
    message: `TitanGold Publisher live-test mode check — ${ts}`,
  });

  const afterLiveTestMode = await api(token, 'GET', '/api/v1/data-hub/telegram-publishers/runtime-mode');

  const enableLive = await api(token, 'PUT', '/api/v1/data-hub/telegram-publishers/runtime-mode', {
    mode: 'live',
    confirm_runtime_mode_change: true,
    acknowledge_live_delivery_risk: true,
    reason: 'P3 browser QA permanent live verification',
  });

  const liveSend = await api(token, 'POST', `/api/v1/data-hub/telegram-publishers/${pub.id}/test`, {
    message: `TitanGold Publisher live mode check — ${ts}`,
  });

  const afterLiveMode = await api(token, 'GET', '/api/v1/data-hub/telegram-publishers/runtime-mode');

  const restoreDryRun = await api(token, 'PUT', '/api/v1/data-hub/telegram-publishers/runtime-mode', {
    mode: 'dry_run',
    confirm_runtime_mode_change: true,
    reason: 'P3 browser QA rollback to safe dry-run',
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  const telegramApiCalls = [];
  page.on('request', req => {
    if (req.url().includes('api.telegram.org')) telegramApiCalls.push(req.url());
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
  await page.getByRole('tab', { name: /Advanced Features|امکانات پیشرفته/i }).click();
  await page.getByRole('tab', { name: /Telegram Publisher|ناشر تلگرام/i }).click();
  await page.waitForTimeout(2000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'telegram-publisher-p3-runtime-mode-card.png'), fullPage: false });

  await browser.close();

  const evidence = {
    phase: 'DH-TELEGRAM-PUBLISHER-P3',
    timestamp: ts,
    publisher_id: pub.id,
    initialMode: initialMode.json,
    dryRunTest: dryRunTest.json,
    enableLiveTest: enableLiveTest.json,
    liveTestSend: liveTestSend.json,
    afterLiveTestMode: afterLiveTestMode.json,
    enableLive: enableLive.json,
    liveSend: liveSend.json,
    afterLiveMode: afterLiveMode.json,
    restoreDryRun: restoreDryRun.json,
    browser: {
      modeCardVisible: /Publisher Delivery Mode|حالت تحویل ناشر/i.test(bodyText),
      noDirectTelegramApiCalls: telegramApiCalls.length === 0,
      telegramApiCalls,
    },
    checklist: {
      initialEffectiveDryRun: initialMode.json.effectiveMode === 'dry_run',
      dryRunTestNoMessageId: !dryRunTest.json.telegram_message_id,
      liveTestEnabled: enableLiveTest.json?.configuredMode === 'live_test',
      liveTestSent: liveTestSend.json.status === 'sent' && Boolean(liveTestSend.json.telegram_message_id),
      liveTestConsumed: liveTestSend.json.liveTestConsumed === true,
      revertedAfterLiveTest: afterLiveTestMode.json.effectiveMode === 'dry_run',
      liveModePersists: afterLiveMode.json.configuredMode === 'live',
      liveSendOk: liveSend.json?.status === 'sent',
      rollbackDryRun: restoreDryRun.json?.configuredMode === 'dry_run',
    },
    verdict: 'PENDING',
  };

  const allPass = Object.values(evidence.checklist).every(Boolean)
    && evidence.browser.modeCardVisible
    && evidence.browser.noDirectTelegramApiCalls;

  evidence.verdict = allPass
    ? 'REAL WORKING / CLOSED'
    : 'PARTIAL — review checklist';

  const outPath = path.join(OUT, 'telegram-publisher-p3-runtime-evidence.json');
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`Evidence written: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
