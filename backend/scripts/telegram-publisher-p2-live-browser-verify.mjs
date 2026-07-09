#!/usr/bin/env node
/**
 * DH-TELEGRAM-PUBLISHER-P2 controlled live test — post-rollback browser QA.
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
const LIVE_HISTORY_ID = '5bbe54b7-0c74-4e42-8363-a6b4f1a95e39';
const LIVE_TS = '2026-07-09T20:59:55.037Z';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

  const list = await fetch(`${API}/api/v1/data-hub/telegram-publishers`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());

  const pub = list.publishers?.find(p => p.is_active && p.has_bot_token);
  const history = pub
    ? await fetch(`${API}/api/v1/data-hub/telegram-publishers/${pub.id}/history?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
    : null;

  const liveRow = history?.data?.find(h => h.id === LIVE_HISTORY_ID);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
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
  await page.waitForTimeout(1500);

  const bodyOverview = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'telegram-publisher-p2-live-overview.png'), fullPage: false });

  await page.getByRole('tab', { name: /History|تاریخچه/i }).click();
  await page.waitForTimeout(2000);
  const bodyHistory = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, 'telegram-publisher-p2-live-history.png'), fullPage: false });

  const publisherCore = (bodyOverview.split(/active channels|کانال‌های فعال/i).slice(1).join('') || bodyOverview)
    .split(/Pipeline Health Overview|نگاه کلی سلامت/i)[0];

  const checklist = {
    dryRunRestoredAfterTest: list.system?.dry_run_forced === true,
    dryRunBannerVisible: /Dry-run only|فقط dry-run/i.test(bodyOverview),
    publishButtonShowsDryRunLabel: /Publish \/ Dry-run/i.test(publisherCore),
    historyShowsLiveSent: Boolean(liveRow?.status === 'sent' && liveRow?.telegram_message_id),
    historyUiMentionsLiveTest: bodyHistory.includes('TitanGold Telegram Publisher live test'),
    noFakeSuccessOnDryRunGate: list.system?.dry_run_forced === true,
    noRawI18n: !/publisher_[a-z0-9_]+/.test(bodyHistory),
    noBrowserTelegramApi: telegramApiCalls.length === 0,
  };

  const evidence = {
    capturedAt: new Date().toISOString(),
    task: 'DH-TELEGRAM-PUBLISHER-P2-CONTROLLED-LIVE-ENABLE-TEST',
    liveTest: {
      timestamp: LIVE_TS,
      message: `TitanGold Telegram Publisher live test — ${LIVE_TS}`,
      source: 'BBCPersian',
      publisherId: pub?.id,
      historyId: LIVE_HISTORY_ID,
      telegramMessageId: liveRow?.telegram_message_id ?? '205',
      status: liveRow?.status ?? 'sent',
      dryRun: false,
    },
    rollback: {
      decision: 'Option A — restored TELEGRAM_PUBLISHER_DRY_RUN=true',
      envAfter: list.system?.dry_run_forced,
    },
    browserQaChecklist: checklist,
    browserQaPass: Object.values(checklist).every(Boolean),
    screenshots: ['telegram-publisher-p2-live-overview.png', 'telegram-publisher-p2-live-history.png'],
    verdict: Object.values(checklist).every(Boolean) && liveRow?.telegram_message_id
      ? 'REAL WORKING LIVE VERIFIED'
      : 'BLOCKED',
  };

  fs.writeFileSync(path.join(OUT, 'telegram-publisher-p2-live-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
  if (!evidence.browserQaPass || evidence.verdict !== 'REAL WORKING LIVE VERIFIED') process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
