/**
 * DH-DATA-ARCHIVING-P2 browser + API evidence.
 * Run: cd backend && node scripts/archiving-p2-browser-evidence.mjs
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SHOT_DIR = path.join(ROOT, 'docs/ssot_v3/screenshots');
const EVIDENCE = path.join(SHOT_DIR, 'archiving-p2-browser-evidence.json');

const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const BASE = process.env.API_BASE || 'http://localhost:5002';

const FORBIDDEN = [
    'ai_decisions_archive_2024',
    'ai_decisions_archive_2025',
    'preview_purge',
    'preview_archive',
    'preview_restore',
    'archive_old_decisions',
];

async function main() {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const network = [];
    for (const [method, pathSuffix] of [
        ['GET', '/api/v1/data-hub/archiving/stats'],
        ['GET', '/api/v1/data-hub/archiving/health'],
        ['GET', '/api/v1/data-hub/archiving/partitions'],
        ['GET', '/api/v1/data-hub/archiving/records?limit=50'],
        ['GET', '/api/v1/data-hub/archiving/operations?limit=20'],
    ]) {
        const t0 = Date.now();
        const res = await fetch(`${BASE}${pathSuffix}`, { method, headers });
        network.push({ path: pathSuffix, method, status: res.status, ms: Date.now() - t0 });
    }

    const statsRes = await fetch(`${BASE}/api/v1/data-hub/archiving/stats`, { headers });
    const stats = await statsRes.json();

    const evidence = {
        capturedAt: new Date().toISOString(),
        path: 'DataHub → Advanced Features → Data Archiving',
        user: 'admin (JWT)',
        network,
        networkAll200: network.every(n => n.status === 200),
        metrics: {
            activeRecords: stats.health?.active_records,
            archivedRecords: stats.health?.archived_records,
            pendingArchive: stats.health?.records_pending_archive,
            statusCode: stats.health?.status_code,
        },
        partitionLabels: (stats.partitions || []).map(p => p.label),
        operationLabels: (stats.recent_operations || []).map(o => o.operation_label),
        rawInternalLabels: [],
        rawOperationTypes: [],
        forbiddenInBody: [],
        buttons: {},
        consoleErrors: [],
        screenshots: [],
    };

    try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('http://localhost:3000/?view=ai', { waitUntil: 'networkidle', timeout: 90000 });
        await page.evaluate(t => {
            localStorage.setItem('titan_token', t);
            sessionStorage.setItem('titan_token', t);
        }, token);
        await page.reload({ waitUntil: 'networkidle' });

        await page.getByRole('button', { name: 'Manager' }).click();
        await page.waitForTimeout(1500);
        await page.getByRole('button', { name: 'Data Hub' }).click();
        await page.waitForTimeout(2000);
        await page.getByRole('tab', { name: 'Advanced Features' }).click();
        await page.waitForTimeout(1000);
        await page.getByRole('tab', { name: 'Data Archiving' }).click();
        await page.waitForTimeout(5000);

        const bodyText = await page.evaluate(() => document.body.innerText);
        evidence.forbiddenInBody = FORBIDDEN.filter(s => bodyText.includes(s));
        evidence.rawInternalLabels = FORBIDDEN.filter(s => /ai_decisions_archive/.test(s) && bodyText.includes(s));
        evidence.rawOperationTypes = FORBIDDEN.filter(s => /^preview_/.test(s) && bodyText.includes(s));

        evidence.ui = {
            hasExplanation: bodyText.includes('does not archive DataHub pipeline'),
            hasLifecycle: bodyText.includes('Active AI decisions'),
            hasManualSchedulerNote: bodyText.includes('Manual only'),
            statusLabel: bodyText.match(/Status\s*\n\s*([^\n]+)/)?.[1],
            hasArchive2024: bodyText.includes('Archive 2024'),
            hasPurgePreview: bodyText.includes('Purge preview') || bodyText.includes('Count purge candidates'),
            hasCountOnly: bodyText.includes('Count only') || bodyText.includes('does not delete'),
            notFound: bodyText.includes('Not Found'),
            hasUndefined: bodyText.includes('undefined') || bodyText.includes('null'),
        };

        await page.screenshot({ path: path.join(SHOT_DIR, 'archiving-p2-overview.png'), fullPage: true });

        await page.evaluate(() => {
            const el = [...document.querySelectorAll('p')].find(p => p.textContent.includes('Archive partitions'));
            el?.scrollIntoView({ block: 'start' });
        });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOT_DIR, 'archiving-p2-partitions.png'), fullPage: true });

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOT_DIR, 'archiving-p2-operations.png'), fullPage: true });

        evidence.consoleErrors = consoleErrors;
        evidence.screenshots = [
            'archiving-p2-overview.png',
            'archiving-p2-partitions.png',
            'archiving-p2-operations.png',
        ];
        await browser.close();
    } catch (err) {
        evidence.playwrightError = err.message;
    }

    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
