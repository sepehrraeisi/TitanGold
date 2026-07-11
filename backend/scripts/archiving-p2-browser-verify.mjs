#!/usr/bin/env node
/**
 * DH-DATA-ARCHIVING-P2 browser verification + screenshots.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const APP = process.env.APP || 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const EVIDENCE = path.join(OUT, process.env.EVIDENCE_FILE || 'archiving-p2-browser-evidence.json');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

const FORBIDDEN = [
    'ai_decisions_archive_2024',
    'ai_decisions_archive_2025',
    'preview_purge',
    'preview_archive',
    'preview_restore',
];

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };
    const network = [];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });

    page.on('response', res => {
        const url = res.url();
        if (url.includes('/data-hub/archiving')) {
            network.push({
                url: url.replace(/^https?:\/\/[^/]+/, ''),
                status: res.status(),
            });
        }
    });

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
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
    await page.getByRole('button', { name: 'Migrate Now' }).click({ timeout: 2000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    await page.getByRole('button', { name: 'Manager', exact: true }).click({ timeout: 15000 });
    await page.getByText('Artemis Central', { exact: false }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Data Hub' }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: 'Advanced Features' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('tab', { name: 'Data Archiving' }).click();
    await page.getByText('Active records').waitFor({ timeout: 30000 });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const forbiddenInBody = FORBIDDEN.filter(s => bodyText.includes(s));

    const metrics = await page.evaluate(() => {
        const text = document.body.innerText;
        const pick = label => {
            const re = new RegExp(`${label}\\s*\\n\\s*(\\d+|[^\\n]+)`, 'i');
            const m = text.match(re);
            return m ? m[1].trim() : null;
        };
        return {
            activeRecords: pick('Active records'),
            archivedRecords: pick('Archived records'),
            pendingArchive: pick('Pending archive'),
            status: pick('Status'),
            hasExplanation: text.includes('does not archive DataHub pipeline'),
            hasManualNote: text.includes('Manual only'),
            hasArchive2024: text.includes('Archive 2024'),
            hasArchive2025: text.includes('Archive 2025'),
            hasArchive2026: text.includes('Archive 2026'),
            hasRestoreEmptyState: text.includes('No archived decisions are available yet'),
            hasCountOnly: text.includes('Count only'),
            hasPurgePreviewLabel: text.includes('Purge preview') || text.includes('Purge Preview'),
            hasArchivePreviewLabel: text.includes('Archive Preview'),
            notFound: text.includes('Not Found'),
            hasUndefined: text.includes('undefined') || text.includes('null'),
        };
    });

    await page.screenshot({ path: path.join(OUT, 'archiving-p2-overview.png'), fullPage: true });
    await page.getByText('Archive partitions', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'archiving-p2-partitions.png'), fullPage: true });
    await page.getByText('Recent API operations', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'archiving-p2-operations.png'), fullPage: true });

    const evidence = {
        capturedAt: new Date().toISOString(),
        appUrl: APP,
        path: 'DataHub → Advanced Features → Data Archiving',
        user: user.email,
        role: user.role,
        metrics,
        forbiddenInBody,
        rawInternalLabels: forbiddenInBody.filter(s => s.includes('ai_decisions')),
        rawOperationTypes: forbiddenInBody.filter(s => s.startsWith('preview_')),
        consoleErrors,
        network,
        networkAll200: network.length > 0 && network.every(n => n.status >= 200 && n.status < 400),
        screenshots: [
            'archiving-p2-overview.png',
            'archiving-p2-partitions.png',
            'archiving-p2-operations.png',
        ],
    };

    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
