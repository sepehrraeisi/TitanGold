#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P7.3 — proxy route regression + write auth + browser verify.
 */
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
const COLLECTOR_PATHS = [
    '/api/telegram-collector/health',
    '/api/telegram-collector/session/status',
    '/api/telegram-collector/accounts',
    '/api/telegram-collector/collector-channels',
];

async function probe(url, opts = {}) {
    const started = Date.now();
    try {
        const res = await fetch(url, opts);
        const text = await res.text();
        const contentType = res.headers.get('content-type');
        const isHtml = (contentType || '').includes('text/html') || text.trim().startsWith('<');
        let jsonOk = false;
        if (!isHtml && contentType?.includes('json')) {
            try { JSON.parse(text); jsonOk = true; } catch { jsonOk = false; }
        }
        return {
            url,
            status: res.status,
            latencyMs: Date.now() - started,
            contentType,
            responseKind: isHtml ? 'html' : jsonOk ? 'json' : 'text',
            isHtml,
            bodySnippet: text.slice(0, 120).replace(/\s+/g, ' '),
        };
    } catch (e) {
        return { url, error: e.message, latencyMs: Date.now() - started };
    }
}

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

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const adminToken = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const viewerToken = jwt.sign({ userId: ADMIN_ID, role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

    const nginxProbes = await Promise.all(COLLECTOR_PATHS.map(p => probe(`${APP}${p}`)));
    const direct5003 = await Promise.all(COLLECTOR_PATHS.map(p => probe(`http://127.0.0.1:5003${p}`)));
    const direct3002 = await Promise.all(COLLECTOR_PATHS.map(p => probe(`http://127.0.0.1:3002${p}`)));

    const channelsRes = await fetch(`${APP}/api/telegram-collector/collector-channels`);
    const channelsData = await channelsRes.json();
    const channelId = channelsData?.channels?.[0]?.id;

    const writeAuth = [];
    if (channelId) {
        writeAuth.push(await probe(`${APP}/api/telegram-collector/collector-channels/${channelId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: 'normal' }),
        }));
        writeAuth.push(await probe(`${APP}/api/telegram-collector/collector-channels/${channelId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: 'low' }),
        }));
    }
    writeAuth.push(await probe(`${APP}/api/telegram-collector/channels/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
    }));
    writeAuth.push(await probe(`${APP}/api/telegram-collector/channels/refresh`, { method: 'POST' }));

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const network = [];
    const feedResults = [];

    page.on('response', res => {
        const url = res.url();
        if (url.includes('telegram-collector') || url.includes('/api/v1/telegram')) {
            network.push({
                url: url.replace(/^https?:\/\/[^/]+/, ''),
                status: res.status(),
                contentType: res.headers()['content-type'] || null,
            });
        }
    });

    let navigationError = null;
    try {
        await page.goto(`${APP}/?view=ai`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.evaluate(({ user: u, token: tk }) => {
            localStorage.setItem('titan_token', tk);
            localStorage.setItem('titan_user', JSON.stringify(u));
        }, { user, token: adminToken });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForTimeout(2000);
        await dismissOverlays(page);
        await forceClick(page, page.getByRole('button', { name: /Manager|مدیر/i }).first());
        await forceClick(page, page.getByRole('button', { name: /Data Hub|مرکز داده/i }));
        await forceClick(page, page.getByRole('tab', { name: /Telegram Collector|کلکتور/i }));
        await page.waitForTimeout(6000);
    } catch (err) {
        navigationError = err instanceof Error ? err.message : String(err);
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    const uiMetrics = {
        hasProxyUnreachable: /proxy is unreachable/i.test(bodyText),
        hasHtml404: bodyText.includes('404 Not Found'),
        collectorStatusHealthy: /Collector Status[\s\S]{0,80}Healthy|وضعیت[\s\S]{0,80}سالم/i.test(bodyText),
        collectorStatusDegraded: /Degraded|تضعیف/i.test(bodyText),
        hasAverageLatency: /Average latency[\s\S]{0,30}[\d.]+|میانگین تأخیر[\s\S]{0,30}[\d.]+/i.test(bodyText),
        hasLastProcessed: /Last Processed[\s\S]{0,40}[^\s—-]/i.test(bodyText),
        accountsLoaded: !/Failed to load accounts/i.test(bodyText),
        channelsLoaded: !/Failed to load channels/i.test(bodyText),
    };

    const analyticsTabs = page.getByRole('tablist', { name: /Telegram analytics|ناوبری/i });
    const tabNames = [
        { re: /Overview|نمای کلی/i },
        { re: /AI Inbox|صندوق/i },
        { re: /Categories|دسته/i, scope: analyticsTabs },
        { re: /Breaking|خبر/i, scope: analyticsTabs },
        { re: /Geographic|جغراف/i, scope: analyticsTabs },
    ];
    const tabsLoaded = [];
    for (const { re, scope } of tabNames) {
        try {
            const tab = (scope || page).getByRole('tab', { name: re }).first();
            await forceClick(page, tab);
            await page.waitForTimeout(2000);
            tabsLoaded.push({ tab: re.source, ok: true });
        } catch (e) {
            tabsLoaded.push({ tab: re.source, ok: false, error: e.message });
        }
    }

    try {
        await forceClick(page, analyticsTabs.getByRole('tab', { name: /AI Inbox|صندوق/i }));
        await page.waitForTimeout(3000);
        for (const agentKey of AGENT_KEYS) {
            const t0 = Date.now();
            const btn = page.locator(`[data-agent-key="${agentKey}"]`).first();
            let feedStatus = 0;
            try {
                const [, feedRes] = await Promise.all([
                    btn.click({ timeout: 15000, force: true }),
                    page.waitForResponse(r => r.url().includes(`/agents/${agentKey}/feed`), { timeout: 20000 }),
                ]);
                feedStatus = feedRes.status();
            } catch {
                feedStatus = network.filter(n => n.url.includes(`/agents/${agentKey}/feed`)).slice(-1)[0]?.status ?? 0;
            }
            feedResults.push({ agentKey, loadMs: Date.now() - t0, feedStatus });
            await page.getByRole('button', { name: /Back|بازگشت/i }).click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(500);
            await forceClick(page, analyticsTabs.getByRole('tab', { name: /AI Inbox|صندوق/i }));
            await page.waitForTimeout(800);
        }
    } catch (e) {
        feedResults.push({ error: e.message });
    }

    await page.screenshot({ path: path.join(OUT, 'telegram-collector-p73-current.png'), fullPage: true });

    const endpointsOk = nginxProbes.every(p => p.status === 200 && p.responseKind === 'json' && !p.isHtml);
    const writeAuthChecks = {
        adminPatch: writeAuth[0]?.status === 200,
        viewerPatch: writeAuth[1]?.status === 403 || writeAuth[1]?.status === 401,
        adminRefresh: writeAuth[2]?.status === 200,
        noAuthRefresh: writeAuth[3]?.status === 401,
    };
    const writeOk = Object.values(writeAuthChecks).every(Boolean);
    const feedOk = feedResults.length >= 5 &&
        feedResults.every(r => !r.error && r.feedStatus === 200 && r.loadMs < 5000);
    const tabsOk = tabsLoaded.filter(t => t.ok).length >= 5;
    const uiOk = !uiMetrics.hasProxyUnreachable && !uiMetrics.hasHtml404 &&
        uiMetrics.collectorStatusHealthy && !uiMetrics.collectorStatusDegraded &&
        uiMetrics.accountsLoaded && uiMetrics.channelsLoaded;

    const evidence = {
        capturedAt: new Date().toISOString(),
        phase: 'P7.3-PROXY-ROUTE-REGRESSION-FIX',
        appUrl: APP,
        sourceOfTruth: { collectorPort: 5003, nginxUpstream: '127.0.0.1:5003' },
        nginxProbes,
        directPort5003: direct5003,
        directPort3002: direct3002,
        writeAuth,
        writeAuthChecks,
        uiMetrics,
        tabsLoaded,
        feedResults,
        browserNetwork: network.filter(n => n.url.includes('telegram-collector')),
        navigationError,
        verdict: endpointsOk && writeOk && uiOk && tabsOk && feedOk ? 'REAL WORKING' : 'PARTIAL',
    };

    fs.writeFileSync(path.join(OUT, 'telegram-collector-p73-route-regression-browser-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
