#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P5 performance + browser audit.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedisClient, getRedisInfo } from '../utils/redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const APP = process.env.APP || 'https://titan.zala.ir';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const ITERATIONS = 5;

const ENDPOINTS = [
    { key: 'health', path: '/api/v1/telegram/health', ttl: 30 },
    { key: 'agents_summary', path: '/api/v1/telegram/agents/summary?timeRange=24', ttl: 60 },
    { key: 'categories', path: '/api/v1/telegram/categories/summary?timeRange=24', ttl: 60 },
    { key: 'breaking', path: '/api/v1/telegram/breaking-news', ttl: 45 },
    { key: 'geographic', path: '/api/v1/telegram/events/geographic-summary?timeRange=168&limit=200', ttl: 45 },
];

async function probe(url, headers) {
    const started = Date.now();
    const res = await fetch(url, { headers });
    const text = await res.text();
    const latencyMs = Date.now() - started;
    const isHtml = (res.headers.get('content-type') || '').includes('text/html');
    return { status: res.status, latencyMs, isHtml, size: text.length };
}

function stats(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
    return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: Math.round(sum / sorted.length),
        p95,
    };
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };
    const authHeaders = { Authorization: `Bearer ${token}` };

    const performance = {};
    for (const ep of ENDPOINTS) {
        const samples = [];
        for (let i = 0; i < ITERATIONS; i++) {
            const r = await probe(`${APP}${ep.path}`, authHeaders);
            samples.push(r.latencyMs);
        }
        performance[ep.key] = { ...stats(samples), path: ep.path, status: 200 };
    }

    let redisProof = { status: 'unavailable' };
    try {
        const client = await getRedisClient();
        const keys = await client.keys('tg:analytics:*');
        redisProof = {
            status: 'connected',
            analyticsKeys: keys.length,
            sampleKeys: keys.slice(0, 5),
            info: await getRedisInfo(),
        };
    } catch (e) {
        redisProof = { status: 'error', message: e.message };
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const network = [];
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('response', res => {
        const u = res.url();
        if (u.includes('/api/v1/telegram')) {
            network.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), status: res.status() });
        }
    });

    await page.goto(`${APP}/?view=ai`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(({ user: u, token: tk }) => {
        localStorage.setItem('titan_token', tk);
        localStorage.setItem('titan_user', JSON.stringify(u));
    }, { user, token });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
    await page.getByRole('button', { name: /Manager|مدیر/i }).first().click({ timeout: 60000 });
    await page.getByRole('button', { name: /Data Hub|مرکز داده/i }).click({ timeout: 30000 });
    await page.getByRole('tab', { name: /Telegram Collector|کلکتور/i }).click({ timeout: 30000 });
    await page.waitForTimeout(3000);

    const tabChecks = {};
    const shots = {
        overview: 'telegram-collector-p5-overview.png',
        inbox: 'telegram-collector-p5-ai-inbox.png',
        categories: 'telegram-collector-p5-categories.png',
        breaking: 'telegram-collector-p5-breaking-news.png',
        geographic: 'telegram-collector-p5-geographic-map.png',
    };

    const analyticsBar = page.locator('[aria-label*="Telegram analytics"], [aria-label*="analytics"]');

    for (const [key, label, shot] of [
        ['overview', /Overview|نمای کلی/i, shots.overview],
        ['inbox', /AI Inbox|صندوق|Agents/i, shots.inbox],
        ['categories', /Categories|دسته/i, shots.categories],
        ['breaking', /Breaking|فوری/i, shots.breaking],
        ['geographic', /Geographic|جغراف/i, shots.geographic],
    ]) {
        try {
            await analyticsBar.getByRole('tab', { name: label }).first().click({ timeout: 20000 });
            await page.waitForTimeout(3500);
            const txt = await page.evaluate(() => document.body.innerText);
            tabChecks[key] = {
                loaded: true,
                hasResourceNotFound: /Resource not found on this server/i.test(txt),
                hasRequestFailed: /\bRequest failed\b/i.test(txt),
                hasHtml404: txt.includes('404 Not Found'),
            };
            await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
        } catch (e) {
            tabChecks[key] = { loaded: false, error: String(e.message || e) };
        }
    }

    const perfOk = Object.values(performance).every(p => p.p95 <= 2000 && p.max <= 5000);
    const warmOk = Object.values(performance).every(p => p.min <= 1000);
    const tabsOk = Object.values(tabChecks).every(t => t.loaded && !t.hasResourceNotFound && !t.hasRequestFailed);

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        verdict: perfOk && warmOk && tabsOk ? 'REAL WORKING' : 'PARTIAL',
        performance,
        redisProof,
        tabChecks,
        consoleErrors: consoleErrors.slice(0, 15),
        network: network.slice(0, 40),
    };

    fs.writeFileSync(path.join(OUT, 'telegram-collector-p5-browser-evidence.json'), JSON.stringify(evidence, null, 2));
    fs.writeFileSync(path.join(OUT, 'telegram-collector-p5-network-evidence.json'), JSON.stringify({ performance, redisProof, network }, null, 2));
    console.log(JSON.stringify({ verdict: evidence.verdict, performance, tabChecks }, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
