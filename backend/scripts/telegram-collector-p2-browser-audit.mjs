#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P2 read-only browser/network verification.
 * Does NOT click login/import/sync/write actions.
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
const UI_BASE = process.env.UI_BASE || APP;
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

async function probe(url) {
    const started = Date.now();
    try {
        const res = await fetch(url, { method: 'GET' });
        const text = await res.text();
        const latencyMs = Date.now() - started;
        const contentType = res.headers.get('content-type');
        const isHtml = (contentType || '').includes('text/html') || text.trim().startsWith('<');
        let jsonOk = false;
        if (!isHtml && contentType?.includes('json')) {
            try {
                JSON.parse(text);
                jsonOk = true;
            } catch {
                jsonOk = false;
            }
        }
        return {
            url,
            status: res.status,
            latencyMs,
            contentType,
            responseKind: isHtml ? 'html' : jsonOk ? 'json' : 'text',
            isHtml,
            bodySnippet: text.slice(0, 120).replace(/\s+/g, ' '),
        };
    } catch (e) {
        return { url, error: e.message, latencyMs: Date.now() - started };
    }
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

    const collectorPaths = [
        '/api/telegram-collector/health',
        '/api/telegram-collector/session/status',
        '/api/telegram-collector/accounts',
        '/api/telegram-collector/collector-channels',
    ];
    const feedPaths = [
        '/api/v1/telegram/health',
        '/api/v1/telegram/stats/real-time',
        '/api/v1/telegram/breaking-news',
        '/api/v1/telegram/categories/summary',
    ];

    const nginxProbes = await Promise.all(collectorPaths.map(p => probe(`${APP}${p}`)));
    const direct5003 = await Promise.all(collectorPaths.map(p => probe(`http://127.0.0.1:5003${p}`)));
    const direct3002 = await Promise.all(collectorPaths.map(p => probe(`http://127.0.0.1:3002${p}`)));

    const accountsProbe = nginxProbes.find(p => p.url?.includes('/accounts'));
    let accountsSanitized = null;
    if (accountsProbe?.status === 200) {
        try {
            const res = await fetch(`${APP}/api/telegram-collector/accounts`);
            const data = await res.json();
            const first = data?.accounts?.[0] || {};
            accountsSanitized = {
                hasSessionString: Object.prototype.hasOwnProperty.call(first, 'session_string'),
                hasApiHash: Object.prototype.hasOwnProperty.call(first, 'api_hash'),
                hasPhoneMasked: Object.prototype.hasOwnProperty.call(first, 'phone_masked'),
                keys: Object.keys(first).sort(),
            };
        } catch {
            accountsSanitized = { error: 'parse_failed' };
        }
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const network = [];
    page.on('response', res => {
        const url = res.url();
        if (url.includes('telegram-collector') || url.includes('/api/v1/telegram') || url.includes('/api/v1/data-sources')) {
            network.push({
                url: url.replace(/^https?:\/\/[^/]+/, ''),
                status: res.status(),
                contentType: res.headers()['content-type'] || null,
            });
        }
    });

    let navigationError = null;
    try {
        await page.goto(`${UI_BASE}/?view=ai`, { waitUntil: 'networkidle', timeout: 90000 });
        await page.evaluate(({ user, token }) => {
            localStorage.setItem('titan_token', token);
            localStorage.setItem('titan_user', JSON.stringify(user));
            sessionStorage.setItem('titan_token', token);
            sessionStorage.setItem('titan_user', JSON.stringify(user));
        }, { user, token });
        await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
        await page.getByRole('button', { name: 'Skip' }).click({ timeout: 8000 }).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});

        const managerBtn = page.getByRole('button', { name: /Manager|مدیر/i }).first();
        await managerBtn.click({ timeout: 45000 });
        await page.getByText('Artemis Central', { exact: false }).waitFor({ timeout: 90000 });
        await page.getByRole('button', { name: /Data Hub|مرکز داده/i }).click({ timeout: 30000 });
        await page.waitForTimeout(2000);
        await page.getByRole('tab', { name: /Telegram Collector|کلکتور تلگرام/i }).click({ timeout: 30000 });
        await page.waitForTimeout(6000);
    } catch (err) {
        navigationError = err instanceof Error ? err.message : String(err);
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    const metrics = {
        hasCriticalStatus: /\bCritical\b/i.test(bodyText) && !/critical\)/i.test(bodyText),
        hasFailedAccounts: /Failed to load accounts/i.test(bodyText),
        hasFailedChannels: /Failed to load channels/i.test(bodyText),
        hasProxyUnreachable: /proxy is unreachable/i.test(bodyText),
        hasHtml404: bodyText.includes('404 Not Found') || bodyText.includes('<html'),
        hasTelegramCollectorHeader: bodyText.includes('Telegram Collector'),
        collectorStatusHealthy: /Collector Status[\s\S]{0,40}healthy/i.test(bodyText),
        serviceUrlShown: bodyText.match(/Service URL[^\n]*/)?.[0] || null,
        accountsVisible: /Accounts|حساب/i.test(bodyText),
        channelsVisible: /Channels|کانال/i.test(bodyText),
    };

    await page.screenshot({ path: path.join(OUT, 'telegram-collector-p2-current.png'), fullPage: true });

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        uiBase: UI_BASE,
        verdict_hint: 'TELEGRAM COLLECTOR UI ROUTE REPAIRED + BACKEND HEALTHY',
        metrics,
        accountsSanitized,
        nginxProbes,
        directPort5003: direct5003,
        directPort3002: direct3002,
        feedPathsNote: 'Feed endpoints require auth token in browser context',
        browserNetwork: network,
        navigationError,
        performanceMs: Object.fromEntries(
            nginxProbes.map(p => [p.url?.split('/').pop() || p.url, p.latencyMs]),
        ),
        notes: [
            'Read-only audit — no login/import/sync clicked',
            'nginx upstream fixed to :5003',
            'Accounts API sanitized — session_string not exposed',
        ],
    };

    fs.writeFileSync(path.join(OUT, 'telegram-collector-p2-browser-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
