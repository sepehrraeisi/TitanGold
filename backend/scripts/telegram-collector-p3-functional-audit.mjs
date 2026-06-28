#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P3 functional audit (read-only + safe GET probes).
 * Does NOT complete login OTP, import, sync writes, or mutate production data.
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
        return { url, status: res.status, latencyMs, contentType, isHtml, json, bodySnippet: text.slice(0, 100) };
    } catch (e) {
        return { url, error: e.message, latencyMs: Date.now() - started };
    }
}

const COLLECTOR_GET = [
    '/api/telegram-collector/health',
    '/api/telegram-collector/session/status',
    '/api/telegram-collector/accounts',
    '/api/telegram-collector/collector-channels',
    '/api/telegram-collector/polling/status',
    '/api/telegram-collector/metrics',
];

const FEED_GET = [
    '/api/v1/telegram/health',
    '/api/v1/telegram/stats/real-time',
    '/api/v1/telegram/breaking-news',
    '/api/v1/telegram/categories/summary',
    '/api/v1/data-sources/stats',
    '/api/v1/data-sources/health',
];

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };
    const authHeaders = { Authorization: `Bearer ${token}` };

    const collectorProbes = await Promise.all(COLLECTOR_GET.map(p => probe(`${APP}${p}`)));
    const feedProbes = await Promise.all(FEED_GET.map(p => probe(`${APP}${p}`, { headers: authHeaders })));

    const accountsProbe = collectorProbes.find(p => p.url?.includes('/accounts'));
    let security = { hasSessionString: null, hasPhoneCodeHash: null, hasLoginSession: null };
    if (accountsProbe?.json?.accounts?.[0]) {
        const a = accountsProbe.json.accounts[0];
        security.hasSessionString = Object.prototype.hasOwnProperty.call(a, 'session_string');
        security.hasApiHash = Object.prototype.hasOwnProperty.call(a, 'api_hash');
        security.phoneIsMasked = a.phone === a.phone_masked;
    }

    const loginStartDry = await probe(`${APP}/api/telegram-collector/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const network = [];
    const consoleErrors = [];
    page.on('console', m => {
        if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('response', res => {
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
    await page.evaluate(({ user, token }) => {
        localStorage.setItem('titan_token', token);
        localStorage.setItem('titan_user', JSON.stringify(user));
        sessionStorage.setItem('titan_token', token);
        sessionStorage.setItem('titan_user', JSON.stringify(user));
    }, { user, token });
    await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
    await page.getByRole('button', { name: /Manager|مدیر/i }).first().click({ timeout: 60000 });
    await page.getByRole('button', { name: /Data Hub|مرکز داده/i }).click({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.getByRole('tab', { name: /Telegram Collector|کلکتور تلگرام/i }).click({ timeout: 30000 });
    await page.waitForTimeout(6000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const tabChecks = {};

    for (const [key, label] of [
        ['overview', /Overview|نمای کلی/i],
        ['inbox', /AI Inbox|صندوق/i],
        ['categories', /Categories|دسته/i],
        ['breaking', /Breaking|فوری/i],
        ['geographic', /Geographic|جغراف/i],
    ]) {
        try {
            await page.getByRole('tab', { name: label }).click({ timeout: 15000 });
            await page.waitForTimeout(3000);
            const txt = await page.evaluate(() => document.body.innerText);
            tabChecks[key] = {
                loaded: true,
                hasHtml404: txt.includes('404 Not Found') || txt.includes('<html'),
                hasRawI18n: /\bcollector_[a-z_]+\b/.test(txt),
            };
        } catch {
            tabChecks[key] = { loaded: false };
        }
        await page.getByRole('tab', { name: /Telegram Collector|کلکتور تلگرام/i }).click({ timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1000);
    }

    const metrics = {
        collectorHealthy: /Healthy|سالم/i.test(bodyText),
        hasCritical: /\bCritical\b/i.test(bodyText) && !/critical\)/i.test(bodyText),
        hasHtml404: bodyText.includes('404 Not Found'),
        accountsVisible: /Account|حساب/i.test(bodyText),
        channelsVisible: /Channel|کانال/i.test(bodyText),
        wizardLabel: /Login Wizard|ویزارد/i.test(bodyText),
    };

    await page.screenshot({ path: path.join(OUT, 'telegram-collector-p3-current.png'), fullPage: true });

    const allCollector200 = collectorProbes.every(p => p.status === 200 && !p.isHtml);
    const allFeed200 = feedProbes.every(p => p.status === 200);

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        verdict_hint: allCollector200
            ? 'COLLECTOR READ PATHS VERIFIED — WRITE FLOWS REQUIRE HUMAN OTP'
            : 'COLLECTOR DEGRADED',
        metrics,
        tabChecks,
        security,
        loginStartDry: { status: loginStartDry.status, expectsValidation: loginStartDry.status === 400 },
        collectorProbes,
        feedProbes,
        performanceMs: Object.fromEntries(collectorProbes.map(p => [p.url?.split('/').pop(), p.latencyMs])),
        browserNetwork: network.filter(n => n.url.includes('telegram-collector')),
        consoleErrors: consoleErrors.slice(0, 20),
        limitations: [
            'Login confirm/import/sync write actions not executed (requires Telegram OTP / explicit permission)',
            'Session rotation endpoints not invoked',
        ],
    };

    fs.writeFileSync(path.join(OUT, 'telegram-collector-p3-browser-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
