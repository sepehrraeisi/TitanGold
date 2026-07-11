#!/usr/bin/env node
/**
 * DH-TELEGRAM-COLLECTOR-P6 design system browser audit + screenshots.
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

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

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

    // Dismiss any modal overlays
    await page.evaluate(() => {
        document.querySelectorAll('div.fixed.inset-0').forEach(el => el.remove());
    });

    const analyticsBar = page.locator('[aria-label*="Telegram analytics"], [aria-label*="analytics"]');
    const tabChecks = {};
    const shots = {
        toolbar: 'telegram-collector-p6-toolbar.png',
        overview: 'telegram-collector-p6-overview.png',
        inbox: 'telegram-collector-p6-ai-inbox.png',
        categories: 'telegram-collector-p6-categories.png',
        breaking: 'telegram-collector-p6-breaking-news.png',
        geographic: 'telegram-collector-p6-geographic-map.png',
    };

    // Toolbar screenshot (overview tab default)
    await page.screenshot({ path: path.join(OUT, shots.toolbar), fullPage: false });
    tabChecks.toolbar = { captured: true };

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
            await page.evaluate(() => {
                document.querySelectorAll('div.fixed.inset-0').forEach(el => el.remove());
            });
            const pageInfo = await page.evaluate(() => ({
                text: document.body.innerText,
                hasSegmentedControl: !!document.querySelector('[role="group"]'),
            }));
            tabChecks[key] = {
                loaded: true,
                hasResourceNotFound: /Resource not found on this server/i.test(pageInfo.text),
                hasRequestFailed: /\bRequest failed\b/i.test(pageInfo.text),
                hasSegmentedControl: pageInfo.hasSegmentedControl,
            };
            await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
        } catch (e) {
            tabChecks[key] = { loaded: false, error: String(e.message || e) };
        }
    }

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        phase: 'P6-DESIGN-SYSTEM-POLISH',
        tabChecks,
        screenshots: shots,
        consoleErrors: consoleErrors.slice(0, 15),
    };

    fs.writeFileSync(
        path.join(OUT, 'telegram-collector-p6-browser-evidence.json'),
        JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify({ tabChecks, screenshots: shots }, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
