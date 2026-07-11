#!/usr/bin/env node
/**
 * Data Pipeline final closeout — production browser QA + screenshots + network isolation.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APP = process.env.APP || 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots');
const EVIDENCE = path.join(OUT, 'data-pipeline-closeout-evidence.json');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const PIPELINE_PATH_RE = /\/api\/v1\/data-sources\/pipeline/;

function classifyPipelineUrl(url) {
    const pathOnly = url.replace(/^https?:\/\/[^/]+/, '');
    if (pathOnly.includes('/pipeline/normalization-summary')) return 'normalization-summary';
    if (pathOnly.includes('/pipeline/capacity')) return 'capacity';
    if (pathOnly.includes('/pipeline/backlog')) return 'backlog';
    if (pathOnly.match(/\/pipeline(\?|$)/)) return 'pipeline-fast';
    return 'other';
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const user = { id: ADMIN_ID, username: 'sepehr', role: 'admin', email: 'sepehr@local' };

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

    const allPipelineRequests = [];
    page.on('request', req => {
        const url = req.url();
        if (PIPELINE_PATH_RE.test(url)) {
            allPipelineRequests.push({ phase: 'load', url: url.replace(/^https?:\/\/[^/]+/, ''), kind: classifyPipelineUrl(url) });
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
        localStorage.setItem('titan_migration_dismissed', 'true');
        sessionStorage.setItem('titan_token', token);
        sessionStorage.setItem('titan_user', JSON.stringify(user));
    }, { user, token });
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Manager', exact: true }).click({ timeout: 15000 });
    await page.getByText('Artemis Central', { exact: false }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Data Hub' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('tab', { name: 'Data Pipeline' }).click();

    await page.getByText('Telegram Transfer Health', { exact: true }).waitFor({ timeout: 60000 });
    await page.getByText('Normalization Summary', { exact: true }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    const rawI18nKeys = (bodyText.match(/pipeline_[a-z0-9_]+/g) || []).filter((v, i, a) => a.indexOf(v) === i);
    const pipelineSectionText = await page.evaluate(() => {
        const headings = [...document.querySelectorAll('h2,h3,h4')];
        const pipelineHeading = headings.find(h => h.textContent?.includes('Data Pipeline'));
        let node = pipelineHeading?.closest('[class*="space-y"]') ?? document.body;
        return node.innerText || '';
    });
    const hasRawDash = /(^|\n)\s*—\s*($|\n)/.test(pipelineSectionText);
    const hasBalanced = /Balanced/i.test(bodyText);
    const hasFakeZeroGrid = /Processed \(24h\)\s*\n\s*0\s*\n\s*Passed \(24h\)\s*\n\s*0/.test(bodyText);

    const domChecks = await page.evaluate(() => {
        const text = document.body.innerText;
        const has = s => text.includes(s);
        return {
            telegramTransferHealth: has('Telegram Transfer Health'),
            sourceQualityBoard: has('Source Quality Board'),
            normalizationSummary: has('Normalization Summary'),
            pipelineCapacity: has('Pipeline Capacity'),
            configurationOnly: has('Configuration only'),
            schedulerStopped: has('Stopped') || has('Running') || has('Unknown'),
            backlogCritical: has('Critical') || has('Warning') || has('Normal'),
            backlogTrend: has('Backlog trend (24h)'),
            backlogTrendUnavailable: has('Unavailable'),
            refreshNormalizationButton: !!document.querySelector('button') && text.includes('Refresh normalization'),
            configOnlyBanner: text.includes('Throughput tuning is config-only'),
        };
    });

    await page.screenshot({ path: path.join(OUT, 'data-pipeline-closeout-full.png'), fullPage: true });

    await page.getByText('Normalization Summary', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByText('Pipeline Capacity', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'data-pipeline-closeout-panels.png'), fullPage: false });

    await page.getByText('Source Quality Board', { exact: true }).scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'data-pipeline-closeout-source-quality.png'), fullPage: false });

    const refreshNetwork = [];
    const refreshListener = req => {
        const url = req.url();
        if (PIPELINE_PATH_RE.test(url)) {
            refreshNetwork.push({ url: url.replace(/^https?:\/\/[^/]+/, ''), kind: classifyPipelineUrl(url) });
        }
    };
    page.on('request', refreshListener);

    const refreshBtn = page.getByRole('button', { name: 'Refresh normalization' });
    await refreshBtn.waitFor({ timeout: 15000 });
    const refreshWait = page.waitForResponse(
        res => res.url().includes('/pipeline/normalization-summary') && res.request().method() === 'GET',
        { timeout: 15000 },
    );
    await refreshBtn.click();
    const refreshResponse = await refreshWait.catch(() => null);
    await page.waitForTimeout(1000);
    page.off('request', refreshListener);
    if (refreshResponse) {
        refreshNetwork.push({
            url: refreshResponse.url().replace(/^https?:\/\/[^/]+/, ''),
            kind: 'normalization-summary',
        });
    }

    const refreshIsolation = {
        requests: refreshNetwork,
        onlyNormalizationSummary:
            refreshNetwork.length > 0 &&
            refreshNetwork.every(r => r.kind === 'normalization-summary'),
        noPipelineFast: !refreshNetwork.some(r => r.kind === 'pipeline-fast'),
        noBacklog: !refreshNetwork.some(r => r.kind === 'backlog'),
        noCapacity: !refreshNetwork.some(r => r.kind === 'capacity'),
    };

    const checklist = {
        dataPipelineLoads: domChecks.telegramTransferHealth && domChecks.normalizationSummary,
        noRawI18nKeys: rawI18nKeys.length === 0,
        noRawDash: !hasRawDash,
        noFakeZeros: !hasFakeZeroGrid,
        noBalancedFakeMode: !hasBalanced && domChecks.configurationOnly,
        schedulerStatusVisible: domChecks.schedulerStopped,
        backlogSeverityVisible: domChecks.backlogCritical,
        backlogTrendHonest: domChecks.backlogTrend && domChecks.backlogTrendUnavailable,
        refreshNormalizationIsolated: refreshIsolation.onlyNormalizationSummary,
        sourceQualityBoardWorks: domChecks.sourceQualityBoard,
        telegramTransferHealthWorks: domChecks.telegramTransferHealth,
    };

    const evidence = {
        capturedAt: new Date().toISOString(),
        task: 'DH-DATA-PIPELINE-FINAL-CLOSEOUT',
        commit: '6fa9158',
        commitMessage: 'feat(datahub): final product polish for pipeline operations dashboard',
        environment: {
            frontend: APP,
            backend: process.env.API_URL || 'http://127.0.0.1:5002',
            auth: 'JWT admin (localStorage inject)',
        },
        path: 'AI → Manager → Data Hub → Data Pipeline',
        browserQaChecklist: checklist,
        browserQaPass: Object.values(checklist).every(Boolean),
        domChecks,
        rawI18nKeysFound: rawI18nKeys,
        refreshNormalizationNetwork: refreshIsolation,
        initialPipelineRequests: allPipelineRequests.filter((r, i, arr) => arr.findIndex(x => x.url === r.url && x.phase === r.phase) === i),
        consoleErrors,
        screenshots: [
            'data-pipeline-closeout-full.png',
            'data-pipeline-closeout-panels.png',
            'data-pipeline-closeout-source-quality.png',
        ],
        verdict: Object.values(checklist).every(Boolean) ? 'REAL WORKING / CLOSED' : 'BLOCKED — see checklist failures',
    };

    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();

    if (!evidence.browserQaPass) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
