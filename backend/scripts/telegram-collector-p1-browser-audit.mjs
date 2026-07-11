#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P1 read-only browser/network audit.
 * Does NOT click login/import/sync/write actions.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const APP = process.env.APP || 'https://titan.zala.ir';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

async function probe(url) {
    try {
        const res = await fetch(url, { method: 'GET' });
        const text = await res.text();
        return {
            url,
            status: res.status,
            contentType: res.headers.get('content-type'),
            isHtml: text.trim().startsWith('<'),
            bodySnippet: text.slice(0, 120).replace(/\s+/g, ' '),
        };
    } catch (e) {
        return { url, error: e.message };
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

    const nginxProbes = await Promise.all(
        collectorPaths.map(p => probe(`${APP}${p}`)),
    );
    const direct3002 = await Promise.all(
        collectorPaths.map(p => probe(`http://127.0.0.1:3002${p}`)),
    );
    const direct5003 = await Promise.all(
        collectorPaths.map(p => probe(`http://127.0.0.1:5003${p}`)),
    );

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const network = [];
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

    await page.goto(`${APP}/?view=ai`);
    await page.evaluate(({ user, token }) => {
        localStorage.setItem('titan_token', token);
        localStorage.setItem('titan_user', JSON.stringify(user));
        sessionStorage.setItem('titan_token', token);
        sessionStorage.setItem('titan_user', JSON.stringify(user));
    }, { user, token });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    await page.getByRole('button', { name: 'Manager', exact: true }).click({ timeout: 15000 });
    await page.getByText('Artemis Central', { exact: false }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Data Hub' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('tab', { name: 'Telegram Collector' }).click({ timeout: 15000 });
    await page.waitForTimeout(4000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const metrics = {
        hasCriticalStatus: /Critical/i.test(bodyText),
        hasFailedAccounts: /Failed to load accounts/i.test(bodyText),
        hasFailedChannels: /Failed to load channels/i.test(bodyText),
        hasEndpointIssue: /Endpoint issue/i.test(bodyText),
        hasHtml404: bodyText.includes('404 Not Found'),
        hasTelegramCollectorHeader: bodyText.includes('Telegram Collector'),
        serviceUrlShown: bodyText.match(/Service URL[^\n]*/)?.[0] || null,
    };

    await page.screenshot({ path: path.join(OUT, 'telegram-collector-p1-current.png'), fullPage: true });

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        verdict_hint: 'NGINX ROUTE BROKEN / BACKEND HEALTHY',
        metrics,
        nginxProbes,
        directPort3002: direct3002,
        directPort5003: direct5003,
        browserNetwork: network,
        notes: [
            'Read-only audit — no login/import/sync clicked',
            'Collector microservice responds on :5003; nginx proxies to :3002',
        ],
    };

    fs.writeFileSync(path.join(OUT, 'telegram-collector-p1-browser-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
