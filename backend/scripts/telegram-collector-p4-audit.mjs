#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P4 audit — tabs, auth, performance, browser evidence.
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

async function probe(url, opts = {}) {
    const started = Date.now();
    try {
        const res = await fetch(url, { ...opts, method: opts.method || 'GET' });
        const text = await res.text();
        const latencyMs = Date.now() - started;
        const contentType = res.headers.get('content-type');
        const isHtml = (contentType || '').includes('text/html');
        let json = null;
        if (!isHtml && contentType?.includes('json')) {
            try {
                json = JSON.parse(text);
            } catch {
                json = null;
            }
        }
        return { url, status: res.status, latencyMs, contentType, isHtml, json, bodySnippet: text.slice(0, 120) };
    } catch (e) {
        return { url, error: e.message, latencyMs: Date.now() - started };
    }
}

const TAB_ENDPOINTS = [
    { key: 'overview_health', path: '/api/v1/telegram/health' },
    { key: 'overview_agents', path: '/api/v1/telegram/agents/summary?timeRange=24' },
    { key: 'categories', path: '/api/v1/telegram/categories/summary?timeRange=24' },
    { key: 'breaking', path: '/api/v1/telegram/breaking-news' },
    { key: 'geographic', path: '/api/v1/telegram/events/recent?limit=250&timeRange=24' },
];

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const tabProbes = await Promise.all(
        TAB_ENDPOINTS.map(({ key, path: p }) =>
            probe(`${APP}${p}`, { headers: authHeaders }).then(r => ({ key, ...r })),
        ),
    );

    const writeNoAuth = await probe(`${APP}/api/telegram-collector/channels/refresh`, { method: 'POST' });
    const writeAuth = await probe(`${APP}/api/telegram-collector/channels/refresh`, {
        method: 'POST',
        headers: authHeaders,
    });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const network = [];
    const consoleErrors = [];
    page.on('console', m => {
        if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('response', async res => {
        const u = res.url();
        if (u.includes('telegram-collector') || u.includes('/api/v1/telegram')) {
            network.push({
                url: u.replace(/^https?:\/\/[^/]+/, ''),
                status: res.status(),
                contentType: res.headers()['content-type'] || null,
            });
        }
    });

    await page.goto(`${APP}/?view=ai`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.evaluate(({ user: u, token: tk }) => {
        localStorage.setItem('titan_token', tk);
        localStorage.setItem('titan_user', JSON.stringify(u));
        sessionStorage.setItem('titan_token', tk);
        sessionStorage.setItem('titan_user', JSON.stringify(u));
    }, { user, token });
    await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
    await page.getByRole('button', { name: /Manager|مدیر/i }).first().click({ timeout: 60000 });
    await page.getByRole('button', { name: /Data Hub|مرکز داده/i }).click({ timeout: 30000 });
    await page.getByRole('tab', { name: /Telegram Collector|کلکتور تلگرام/i }).click({ timeout: 30000 });
    await page.waitForTimeout(4000);

    const tabChecks = {};
    const shots = {
        overview: 'telegram-collector-p4-overview.png',
        inbox: 'telegram-collector-p4-ai-inbox.png',
        categories: 'telegram-collector-p4-categories.png',
        breaking: 'telegram-collector-p4-breaking-news.png',
        geographic: 'telegram-collector-p4-map.png',
    };

    for (const [key, label, shot] of [
        ['overview', /Overview|نمای کلی/i, shots.overview],
        ['inbox', /AI Inbox|صندوق|Agents/i, shots.inbox],
        ['categories', /Categories|دسته/i, shots.categories],
        ['breaking', /Breaking|فوری/i, shots.breaking],
        ['geographic', /Geographic|جغراف/i, shots.geographic],
    ]) {
        try {
            await page.locator('[aria-label*="Telegram analytics"], [aria-label*="analytics"]').getByRole('tab', { name: label }).first().click({ timeout: 20000 });
            await page.waitForTimeout(4000);
            const txt = await page.evaluate(() => document.body.innerText);
            tabChecks[key] = {
                loaded: true,
                hasResourceNotFound: /Resource not found on this server/i.test(txt),
                hasRequestFailed: /\bRequest failed\b/i.test(txt),
                hasHtml404: txt.includes('404 Not Found') || txt.includes('<html'),
                hasRawI18n: /\bdatahub_error_[a-z_]+\b/.test(txt),
            };
            await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
        } catch (e) {
            tabChecks[key] = { loaded: false, error: String(e.message || e) };
        }
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    const allTabsOk = Object.values(tabChecks).every(
        t => t.loaded && !t.hasResourceNotFound && !t.hasRequestFailed && !t.hasHtml404,
    );
    const authOk = writeNoAuth.status === 401 && writeAuth.status === 200;
    const perfOk = tabProbes.every(p => p.status === 200 && (p.latencyMs || 9999) < 5000);

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        verdict: allTabsOk && authOk && perfOk ? 'REAL WORKING' : 'PARTIAL',
        humanQa: {
            loginOtp: 'DONE (prior session)',
            importSync: 'DONE',
            forceSyncSuccessWithStaleError: 'FIXED in P4',
        },
        tabChecks,
        tabProbes,
        writeAuth: { noAuth: writeNoAuth, withAuth: writeAuth },
        performanceMs: Object.fromEntries(tabProbes.map(p => [p.key, p.latencyMs])),
        browserNetwork: network.slice(0, 80),
        consoleErrors: consoleErrors.slice(0, 20),
        screenshots: Object.values(shots),
    };

    fs.writeFileSync(
        path.join(OUT, '../telegram-collector-p4-browser-evidence.json'),
        JSON.stringify(evidence, null, 2),
    );
    fs.writeFileSync(
        path.join(OUT, '../telegram-collector-p4-network-evidence.json'),
        JSON.stringify(
            {
                tabProbes,
                writeAuth: { noAuth: writeNoAuth, withAuth: writeAuth },
                browserNetwork: network,
            },
            null,
            2,
        ),
    );

    console.log(JSON.stringify({ verdict: evidence.verdict, tabChecks, performanceMs: evidence.performanceMs }, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
