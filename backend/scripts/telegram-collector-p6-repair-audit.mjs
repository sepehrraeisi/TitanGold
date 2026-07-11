#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P6 Human QA repair — production browser verification.
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

const RAW_KEYS = [
    'telegram_data_overview_desc',
    'processed_messages',
    'agent_impacts',
    'avg_impact_score',
    'actions_required',
    'last_processed',
    'telegram_ai_inbox_desc',
];

const RAW_ENUMS = [
    'medium_term',
    'SANCTIONS_EMBARGO',
    'FOREX_CURRENCY',
    'MIDDLE_EAST',
    'PRECIOUS_METALS',
    'ECONOMIC_INDICATORS',
    'NORTH_AMERICA',
];

const FORBIDDEN = [
    'Agent feed API is not available yet',
    'Resource not found on this server',
    'Request failed',
    '404 Not Found',
];

const TAB_PATTERNS = {
    overview: /Overview|نمای کلی/i,
    inbox: /AI Inbox|صندوق/i,
    categories: /Categories|دسته/i,
    breaking: /Breaking News|اخبار/i,
    geographic: /Geographic|جغراف/i,
};

function scanBody(text) {
    const rawKeysInBody = RAW_KEYS.filter(k => text.includes(k));
    const rawEnumsInBody = RAW_ENUMS.filter(e => text.includes(e));
    const forbiddenTextsInBody = FORBIDDEN.filter(f => text.includes(f));
    const snakeCase = (text.match(/\b[a-z]+_[a-z0-9_]+\b/g) || []).filter(
        s => !RAW_KEYS.includes(s) && !['time_range', 'view_details'].includes(s),
    );
    const allCaps = (text.match(/\b[A-Z][A-Z0-9]*(_[A-Z0-9]+)+\b/g) || []).filter(
        s => !RAW_ENUMS.includes(s),
    );
    return { rawKeysInBody, rawEnumsInBody, forbiddenTextsInBody, snakeCase, allCaps };
}

async function dismissOverlays(page) {
    await page.evaluate(() => {
        document.querySelectorAll('div.fixed.inset-0').forEach(el => el.remove());
    });
    await page.getByRole('button', { name: 'Skip' }).click({ timeout: 2000 }).catch(() => {});
    await page.getByRole('button', { name: /Close|Dismiss|Got it|بستن|رد/i }).click({ timeout: 2000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => {
        document.querySelectorAll('div.fixed.inset-0').forEach(el => el.remove());
    });
}

async function forceClick(page, locator) {
    await dismissOverlays(page);
    try {
        await locator.click({ timeout: 15000 });
    } catch {
        await dismissOverlays(page);
        await locator.click({ timeout: 15000, force: true });
    }
}

async function waitForBackend(page, token) {
    for (let i = 0; i < 15; i++) {
        const status = await page.evaluate(async tk => {
            const r = await fetch('/api/v1/telegram/health', {
                headers: { Authorization: `Bearer ${tk}` },
            });
            return r.status;
        }, token);
        if (status === 200) return;
        await page.waitForTimeout(2000);
    }
    throw new Error('Telegram health API did not return 200');
}

async function getTelegramSubTabBar(page) {
    const bar = page.getByRole('tablist', { name: /Telegram analytics|ناوبری تحلیل/i });
    if ((await bar.count()) > 0) return bar;
    const tablists = page.locator('[role="tablist"]');
    const count = await tablists.count();
    for (let i = 0; i < count; i++) {
        const list = tablists.nth(i);
        if ((await list.getByRole('tab', { name: TAB_PATTERNS.categories }).count()) > 0) return list;
    }
    throw new Error('Telegram Collector sub-tab bar not found');
}

async function clickSubTab(page, pattern) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await dismissOverlays(page);
    const scoped = page.getByRole('tablist', { name: /Telegram analytics|ناوبری تحلیل/i }).getByRole('tab', { name: pattern });
    const tab = (await scoped.count()) > 0 ? scoped.first() : page.getByRole('tab', { name: pattern }).first();
    await tab.scrollIntoViewIfNeeded();
    await tab.click({ timeout: 30000 });
    await page.waitForTimeout(4000);
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const networkStatuses = [];
    const consoleErrors = [];
    let bundleHash = null;

    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('response', res => {
        const u = res.url();
        if (u.includes('/assets/') && u.includes('DataHubTab')) {
            const file = u.split('/').pop() || '';
            const m = file.match(/DataHubTab-([^.]+)\.js/);
            if (m) bundleHash = m[1];
        }
        if (u.includes('/api/v1/telegram')) {
            networkStatuses.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), status: res.status() });
        }
    });

    await page.goto(`${APP}/?view=ai`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(({ user: u, token: tk }) => {
        localStorage.setItem('titan_token', tk);
        localStorage.setItem('titan_user', JSON.stringify(u));
    }, { user, token });
    await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    await forceClick(page, page.getByRole('button', { name: /Manager|مدیر/i }).first());
    await forceClick(page, page.getByRole('button', { name: /Data Hub|مرکز داده/i }));
    await forceClick(page, page.getByRole('tab', { name: /Telegram Collector|کلکتور/i }));
    await page.waitForTimeout(4000);
    await dismissOverlays(page);
    await waitForBackend(page, token);

    const tabResults = {};
    const shots = {
        overview: 'telegram-collector-p6-repair-overview.png',
        inbox: 'telegram-collector-p6-repair-ai-inbox.png',
        categories: 'telegram-collector-p6-repair-categories.png',
        breaking: 'telegram-collector-p6-repair-breaking-news.png',
        geographic: 'telegram-collector-p6-repair-geographic-map.png',
    };

    for (const [key, pattern] of Object.entries(TAB_PATTERNS)) {
        try {
            await clickSubTab(page, pattern);
            await dismissOverlays(page);

            if (key === 'breaking' || key === 'geographic') {
                await page.waitForTimeout(3000);
            }

            const text = await page.evaluate(() => document.body.innerText);
            tabResults[key] = { ...scanBody(text), loaded: true };
            await page.screenshot({ path: path.join(OUT, shots[key]), fullPage: true });
        } catch (err) {
            tabResults[key] = { loaded: false, error: String(err.message || err) };
        }
    }

    const allText = await page.evaluate(() => document.body.innerText);
    const globalScan = scanBody(allText);
    const allTabsLoaded = Object.values(tabResults).every(r => r.loaded);
    const allTabsClean = Object.values(tabResults).every(
        r => !r.rawKeysInBody?.length && !r.rawEnumsInBody?.length && !r.forbiddenTextsInBody?.length,
    );

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        phase: 'P6-HUMAN-QA-REPAIR',
        bundleHash,
        tabResults,
        rawKeysInBody: globalScan.rawKeysInBody,
        rawEnumsInBody: globalScan.rawEnumsInBody,
        forbiddenTextsInBody: globalScan.forbiddenTextsInBody,
        networkStatuses: networkStatuses.slice(0, 50),
        screenshots: shots,
        consoleErrors: consoleErrors.filter(e => !e.includes('MEXC') && !e.includes('WebSocket')).slice(0, 10),
        verdict:
            allTabsLoaded &&
            allTabsClean &&
            globalScan.rawKeysInBody.length === 0 &&
            globalScan.rawEnumsInBody.length === 0 &&
            globalScan.forbiddenTextsInBody.length === 0
                ? 'COMPLETE'
                : 'PARTIAL',
    };

    fs.writeFileSync(path.join(OUT, 'telegram-collector-p6-repair-browser-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
    if (evidence.verdict !== 'COMPLETE') process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
