#!/usr/bin/env node
/** P7 browser audit — extends P6 repair navigation pattern. */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const APP = process.env.APP || 'https://titan.zala.ir';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const AGENT_KEYS = ['trend', 'sentiment', 'technical', 'price_prediction', 'fundamental'];
const FORBIDDEN = ['Agent feed API is not available yet', 'Agent feed is not configured yet', 'Request failed'];

async function dismissOverlays(page) {
    await page.evaluate(() => document.querySelectorAll('div.fixed.inset-0').forEach(el => el.remove()));
    await page.getByRole('button', { name: 'Skip' }).click({ timeout: 2000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
}

async function forceClick(page, locator) {
    await dismissOverlays(page);
    try { await locator.click({ timeout: 15000 }); }
    catch { await dismissOverlays(page); await locator.click({ timeout: 15000, force: true }); }
}

async function waitForBackend(page, token) {
    for (let i = 0; i < 10; i++) {
        const status = await page.evaluate(async tk => {
            const r = await fetch('/api/v1/telegram/health', { headers: { Authorization: `Bearer ${tk}` } });
            return r.status;
        }, token);
        if (status === 200) return;
        await page.waitForTimeout(1500);
    }
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const feedResults = [];
    const networkStatuses = [];
    let bundleHash = null;

    page.on('response', res => {
        const u = res.url();
        if (u.includes('DataHubTab')) {
            const m = u.split('/').pop()?.match(/DataHubTab-([^.]+)\.js/);
            if (m) bundleHash = m[1];
        }
        if (u.includes('/agents/') && u.includes('/feed')) {
            networkStatuses.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), status: res.status() });
        }
    });

    await page.goto(`${APP}/?view=ai`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(({ user: u, token: tk }) => {
        localStorage.setItem('titan_token', tk);
        localStorage.setItem('titan_user', JSON.stringify(u));
    }, { user, token });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    await forceClick(page, page.getByRole('button', { name: /Manager|مدیر/i }).first());
    await forceClick(page, page.getByRole('button', { name: /Data Hub|مرکز داده/i }));
    await forceClick(page, page.getByRole('tab', { name: /Telegram Collector|کلکتور/i }));
    await page.waitForTimeout(3000);
    await waitForBackend(page, token);
    await forceClick(page, page.getByRole('tablist', { name: /Telegram analytics|ناوبری/i })
        .getByRole('tab', { name: /AI Inbox|صندوق/i }));
    await page.waitForTimeout(4000);

    for (const agentKey of AGENT_KEYS) {
        const t0 = Date.now();
        let btn = page.locator(`[data-agent-key="${agentKey}"]`).first();
        if ((await btn.count()) === 0) {
            btn = page.locator('button').filter({ hasText: new RegExp(agentKey.replace(/_/g, '.?'), 'i') }).first();
        }
        let feedStatus = 0;
        try {
            const [, feedRes] = await Promise.all([
                btn.click({ timeout: 15000, force: true }),
                page.waitForResponse(r => r.url().includes(`/agents/${agentKey}/feed`), { timeout: 15000 }),
            ]);
            feedStatus = feedRes.status();
        } catch {
            feedStatus = networkStatuses.filter(n => n.url.includes(agentKey)).slice(-1)[0]?.status ?? 0;
        }
        const loadMs = Date.now() - t0;
        const body = await page.evaluate(() => document.body.innerText);
        feedResults.push({
            agentKey,
            loadMs,
            feedStatus,
            forbiddenTextsInBody: FORBIDDEN.filter(f => body.includes(f)),
            hasFeedOrEmpty: /Mark Processed|No feed items|Back to agents|بازگشت|Loading agent feed/i.test(body),
        });
        await page.getByRole('button', { name: /Back|بازگشت/i }).click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        await forceClick(page, page.getByRole('tablist', { name: /Telegram analytics|ناوبری/i })
            .getByRole('tab', { name: /AI Inbox|صندوق/i }));
        await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: path.join(OUT, 'telegram-collector-p7-ai-inbox-feed.png'), fullPage: true });
    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        phase: 'P7-AGENT-FEED-PERFORMANCE',
        bundleHash,
        feedResults,
        forbiddenTextsInBody: [...new Set(feedResults.flatMap(r => r.forbiddenTextsInBody))],
        networkStatuses,
        maxLoadMs: Math.max(...feedResults.map(r => r.loadMs)),
        verdict: feedResults.length >= 5 &&
            feedResults.every(r => !r.forbiddenTextsInBody.length && r.hasFeedOrEmpty && r.feedStatus === 200 && r.loadMs < 5000)
            ? 'REAL WORKING' : 'PARTIAL',
    };
    fs.writeFileSync(path.join(OUT, 'telegram-collector-p7-browser-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
    if (evidence.verdict !== 'REAL WORKING') process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
